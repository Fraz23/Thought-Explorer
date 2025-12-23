
import { GoogleGenAI, Type } from "@google/genai";
import { BranchingResponse, GroundingSource } from "../types";

export const getTopicInfo = async (
  concept: string
): Promise<{ description: string, sources: GroundingSource[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for and provide a one-sentence factual insight for the concept: "${concept}". Return only the description text.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const sources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title || "Source",
            uri: chunk.web.uri
          });
        }
      });
    }

    return { 
      description: response.text?.trim() || "A fascinating area for exploration.", 
      sources 
    };
  } catch (error) {
    console.error("Gemini Topic Info Error:", error);
    return { description: "Explore the connections and history of this concept.", sources: [] };
  }
};

export const getRelatedTopics = async (
  concept: string, 
  count: number = 3,
  contextPath: string[] = [],
  excludeTopics: string[] = [],
  useThinking: boolean = false
): Promise<{ topics: BranchingResponse[], sources: GroundingSource[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const contextDescription = contextPath.length > 0 
    ? `The user's current exploration path is: ${contextPath.join(' -> ')} -> ${concept}.` 
    : `The user is starting an exploration on: ${concept}.`;

  const exclusionPrompt = excludeTopics.length > 0
    ? `Do not suggest any of the following topics: ${excludeTopics.join(', ')}.`
    : "";

  try {
    // Using gemini-3-pro-preview for branches to ensure better Tool Use (Google Search)
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `
        ${contextDescription} 
        ${exclusionPrompt}
        
        TASK:
        1. Use Google Search to find exactly ${count} NEW distinct and high-level topics branching from "${concept}".
        2. Provide a one-sentence factual insight for each topic based on your search results.
        3. Ensure suggestions are unique and specific.
        
        Return the result as a JSON object with a "topics" array.
      `,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        thinkingConfig: useThinking ? { thinkingBudget: 4000 } : undefined,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  topic: { type: Type.STRING },
                  description: { type: Type.STRING }
                },
                required: ["topic", "description"]
              }
            }
          },
          required: ["topics"]
        }
      },
    });

    // Extract grounding sources from the Pro model response
    const sources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title || "Verified Source",
            uri: chunk.web.uri
          });
        }
      });
    }

    const text = response.text || "";
    let jsonStr = text.trim();
    
    // Safety for potential markdown backticks in response
    if (jsonStr.includes("```json")) {
      jsonStr = jsonStr.split("```json")[1].split("```")[0].trim();
    } else if (jsonStr.includes("```")) {
      jsonStr = jsonStr.split("```")[1].split("```")[0].trim();
    }
    
    const data = JSON.parse(jsonStr);
    return { 
      topics: (data.topics || []).slice(0, count), 
      sources 
    };
  } catch (error) {
    console.error("Gemini Branching Error:", error);
    return {
      topics: [
        { topic: `${concept} Dynamics`, description: "Exploring the fundamental forces within this field." },
        { topic: `${concept} Evolution`, description: "Tracing historical development and trajectory." },
        { topic: `${concept} Context`, description: "Analyzing the broader social and technical environment." }
      ].slice(0, count),
      sources: []
    };
  }
};
