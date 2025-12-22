# Thought Explorer

A visual thought exploration and mind mapping tool powered by AI. Discover connections between ideas, explore topics in depth, and visualize your thought processes through an interactive node-based interface.

## Features

- **AI-Powered Exploration**: Uses Google's Gemini AI to generate related topics and detailed information
- **Interactive Mind Map**: Visual node-based interface for exploring thoughts and connections
- **Minimap Navigation**: Overview of your entire thought map for easy navigation
- **Search Functionality**: Quickly find nodes within your exploration
- **Dark/Light Theme**: Switch between themes for comfortable viewing
- **Responsive Design**: Works on both desktop and mobile devices
- **Surprise Topics**: Get inspired with randomly suggested interesting topics

## Prerequisites

- Node.js (version 16 or higher)
- A Google Gemini API key

## Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd thought-explorer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

## Usage

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open your browser and navigate to `http://localhost:5173`

3. Enter a topic you're interested in exploring, or click "Surprise Me" for inspiration

4. Click on nodes to expand them and discover related topics

5. Use the minimap to navigate large thought maps

6. Search for specific nodes using the search bar

## Building for Production

```bash
npm run build
```

## Preview Production Build

```bash
npm run preview
```

## Technologies Used

- React 19
- TypeScript
- Vite
- Google Gemini AI
- CSS for styling

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is private and not licensed for public use.
