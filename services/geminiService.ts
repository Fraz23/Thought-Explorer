
import { GoogleGenAI } from "@google/genai";
import { BranchingResponse, GroundingSource } from "../types";

/**
 * Handles the "entity not found" error by prompting for a key selection
 */
const handleApiError = async (error: any) => {
  console.error("Gemini API Error:", error);
  if (error?.message?.includes("Requested entity was not found") || error?.message?.includes("API_KEY")) {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
    }
  }
  throw error;
};

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
    await handleApiError(error);
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
  // Always create a new instance right before the call to ensure the latest API Key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const contextDescription = contextPath.length > 0 
    ? `The user's current exploration path is: ${contextPath.join(' -> ')} -> ${concept}.` 
    : `The user is starting an exploration on: ${concept}.`;

  const exclusionPrompt = excludeTopics.length > 0
    ? `Do not suggest any of the following topics: ${excludeTopics.join(', ')}.`
    : "";

  try {
    // When using googleSearch, do NOT use responseMimeType: "application/json" 
    // because the response text will contain grounding citations.
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `
        ${contextDescription} 
        ${exclusionPrompt}
        
        TASK:
        1. Use Google Search to find exactly ${count} NEW distinct and high-level topics branching from "${concept}".
        2. For each topic, provide a one-sentence factual insight.
        
        FORMAT YOUR RESPONSE EXACTLY LIKE THIS FOR EACH TOPIC:
        ## TOPIC: [Name]
        ## DESC: [One sentence insight]
        
        Ensure suggestions are unique and specific.
      `,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: useThinking ? { thinkingBudget: 4000 } : undefined,
      },
    });

    // Extract grounding sources
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
    const topics: BranchingResponse[] = [];
    
    // Manual parsing of the structured text format
    const topicBlocks = text.split(/## TOPIC:/g).filter(block => block.trim().length > 0);
    
    topicBlocks.forEach(block => {
      const lines = block.split('\n');
      const topicName = lines[0].trim();
      const descLine = lines.find(l => l.includes('## DESC:'));
      if (topicName && descLine) {
        topics.push({
          topic: topicName,
          description: descLine.replace('## DESC:', '').trim()
        });
      }
    });

    // If parsing failed, try a simpler fallback for safety
    if (topics.length === 0) {
      throw new Error("Failed to parse search results into topics.");
    }

    return { 
      topics: topics.slice(0, count), 
      sources 
    };
  } catch (error) {
    await handleApiError(error);
    // Rethrow to let the UI handle the error state instead of generic fallbacks
    throw error;
  }
};
