# ThoughtExplorer

<div align="center">
  <h3>AI-Powered Concept Mapping & Thought Visualization</h3>
  <p>Transform your ideas into interactive knowledge graphs with real-time AI assistance</p>
</div>

## 🌟 Features

- **AI-Powered Exploration**: Leverage advanced AI to discover and expand on concepts
- **Interactive Mind Mapping**: Create dynamic thought networks with branching ideas
- **Real-Time Search**: Filter and navigate through your knowledge graph instantly
- **Smart Folding**: Collapse and expand thought branches to maintain clarity
- **Internet-Connected Insights**: Get grounded information from web sources
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Dark/Light Themes**: Customize your exploration environment

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- A Gemini API key from Google AI Studio

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Fraz23/Thought-Explorer.git
   cd Thought-Explorer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up your API key**
   - Copy `.env.local` and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   - Navigate to `http://localhost:5174` (or the port shown in terminal)

## 🎯 How to Use

### Getting Started
1. **Enter a root concept** in the main input field (e.g., "Quantum Physics", "Machine Learning")
2. **Click "Branch"** on any node to expand with related concepts
3. **Explore insights** by clicking on nodes to view AI-generated information
4. **Navigate freely** using mouse/touch to pan and zoom

### Key Controls
- **Click nodes** to view detailed insights and sources
- **Branch button** generates new related concepts
- **Fold/Unfold** collapses or expands thought branches
- **Search bar** filters the entire knowledge graph
- **Minimap** provides overview navigation
- **Theme toggle** switches between light and dark modes

### Advanced Features
- **Edit Mode**: Right-click or use edit controls to hide/delete nodes
- **Source Links**: Click source links in insights for original web content
- **Responsive Zoom**: Use mouse wheel or pinch gestures to zoom
- **Smart Layout**: Automatic positioning prevents node overlap

## 🛠️ Development

### Available Scripts
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
npm run type-check # Run TypeScript type checking
```

### Project Structure
```
ThoughtExplorer/
├── components/          # React components
│   ├── ConnectionLine.tsx # Node connection visualization
│   ├── Minimap.tsx      # Overview navigation
│   └── NodeItem.tsx     # Individual thought nodes
├── services/           # External service integrations
│   └── geminiService.ts # AI API communication
├── types.ts           # TypeScript type definitions
├── App.tsx           # Main application component
└── index.tsx         # Application entry point
```

### Tech Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS
- **AI Integration**: Google Gemini API with web search grounding
- **Build Tool**: Vite
- **Deployment**: Ready for static hosting (Vercel, Netlify, etc.)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Built with modern web technologies
- Powered by Google's Gemini AI for intelligent concept exploration
- Inspired by the limitless nature of human curiosity

---

<div align="center">
  <p><strong>Transform your thinking, one connection at a time.</strong></p>
  <p>Made with ❤️ for curious minds everywhere</p>
</div>
