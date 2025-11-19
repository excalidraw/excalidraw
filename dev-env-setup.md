# Excalidraw Development Environment Setup

## Prerequisites

- Node.js >= 18.0.0
- Yarn package manager

## Setup Instructions

### 1. Clone the Repository

```bash
git clone -b AI-DLC https://github.com/bhuvana-s/excalidraw.git
cd excalidraw
```

### 2. Verify Node.js Installation

```bash
node --version
# Should show v18.x.x or higher
```

### 3. Install Yarn (if not already installed)

```bash
npm install -g yarn
```

### 4. Install Project Dependencies

```bash
yarn install
```

This will install all dependencies for the monorepo including the main app and all workspace packages.

### 5. Start the Development Server

```bash
yarn start
```

The application will be available at `http://localhost:5173` (or another port if 5173 is in use).

## Testing the Image to Excalidraw Feature

### Configure AI Provider

1. Click the **3 lines** (hamburger menu) on the top left corner
2. Click **Configure AI**
3. Configure your preferred AI Provider:
   - OpenAI
   - Gemini
   - Claude (AWS)
   - Ollama

### Convert Image to Diagram

1. Click the **More Tools** icon on the top right in the tools ribbon
2. Under **Generate** section, click **Image to Diagram AI**
3. Upload an image containing an architecture diagram that can be converted to Mermaid format
4. Click the **Convert to Mermaid** button on the right bottom of the "Import Image to Diagram" modal dialogue to process the image and convert into mermaid
5. Click the **Insert into Canvas** button on the right botton of the "Import Image to Diagram" to process and convert mermaid into an Excalidraw diagram

## Project Structure

This is a monorepo project using Yarn workspaces with the following structure:

- `excalidraw-app/` - Main application
- `packages/` - Shared packages
- `examples/` - Example implementations

## Available Scripts

- `yarn start` - Start development server
- `yarn build` - Build for production
- `yarn test` - Run tests
- `yarn test:app` - Run app-specific tests
- `yarn fix` - Fix linting and formatting issues

## Troubleshooting

### Port Already in Use

If port 5173 is already in use, Vite will automatically try the next available port.

### Module Resolution Errors

If you encounter module resolution errors, try:

```bash
yarn clean-install
```

This will remove all node_modules and reinstall dependencies.

### Debugging with Chrome Developer Tools

Launch Chrome Developer Tools to monitor and debug the application:

1. Open the application in Chrome browser
2. Press `F12` or right-click and select **Inspect** to open Developer Tools
3. Use the following tabs for debugging:
   - **Console** - View JavaScript errors, warnings, and log messages
   - **Network** - Monitor API calls, request/response headers, and payload data
   - **Sources** - Debug JavaScript code with breakpoints
   - **Application** - Inspect local storage, session storage, and cookies

This is especially useful for:
- Monitoring AI API requests and responses
- Checking network errors or failed requests
- Viewing request headers and authentication tokens
- Debugging JavaScript errors and warnings

## Notes

- The project uses Vite as the build tool
- TypeScript is used throughout the codebase
- The AI features require proper API key configuration for the selected provider
