```
    ███████╗██╗  ██╗ ██████╗ █████╗ ██╗     ██╗██████╗ ██████╗  █████╗ ██╗    ██╗
    ██╔════╝╚██╗██╔╝██╔════╝██╔══██╗██║     ██║██╔══██╗██╔══██╗██╔══██╗██║    ██║
    █████╗   ╚███╔╝ ██║     ███████║██║     ██║██║  ██║██████╔╝███████║██║ █╗ ██║
    ██╔══╝   ██╔██╗ ██║     ██╔══██║██║     ██║██║  ██║██╔══██╗██╔══██║██║███╗██║
    ███████╗██╔╝ ██╗╚██████╗██║  ██║███████╗██║██████╔╝██║  ██║██║  ██║╚███╔███╔╝
    ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚══╝╚══╝
                        ██████╗ ██████╗  █████╗ ██╗██╗
                       ██╔════╝ ██╔══██╗██╔══██╗██║██║
                       ██║  ███╗██████╔╝███████║██║██║
                       ██║   ██║██╔══██╗██╔══██║██║██║
                       ╚██████╔╝██║  ██║██║  ██║██║███████╗
                        ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚══════╝
```

<div align="center">
  <p><strong>AI-Powered Whiteboard with Multi-LLM Support</strong></p>
  <p>OpenAI | Anthropic Claude | Ollama</p>
</div>

<br />

<div align="center">
  <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-blue.svg" />
  <img alt="Self-Hosted" src="https://img.shields.io/badge/self--hosted-yes-green.svg" />
  <img alt="Privacy First" src="https://img.shields.io/badge/privacy-first-purple.svg" />
</div>

<br />

<div align="center">
  <img src="assets/screenshot-demo.png" alt="ExcalidrawGrail Demo - Text-to-Diagram comparison between Ollama and GPT-4o" width="800" />
  <p><em>Text-to-Diagram: Same prompt, different models (Ollama Devstral vs GPT-4o)</em></p>
</div>

## What is ExcalidrawGrail?

ExcalidrawGrail is a fork of [Excalidraw](https://github.com/excalidraw/excalidraw) with **built-in AI support** for multiple LLM providers. No need for external proxies or backend services - configure your API keys directly in the app.

### Key Features

- **Multi-LLM Support** - Choose between OpenAI, Anthropic Claude, or Ollama
- **Text-to-Diagram** - Describe a diagram in natural language, get Mermaid output rendered as shapes
- **Diagram-to-Code** - Draw a wireframe, convert it to HTML/CSS with vision AI
- **Wireframe-to-Prompt** - Generate comprehensive development prompts from wireframes
- **Image Description** - Analyze and describe any image with AI vision
- **Privacy-First** - Your API keys stay in your browser (localStorage)
- **Self-Hosted** - Run locally with Ollama, no external API calls required
- **Model Selection** - Pick any model available from your chosen provider

## Screenshots

<table>
  <tr>
    <td align="center">
      <img src="assets/screenshot-menu.png" alt="AI Settings in Menu" width="280" /><br />
      <em>AI Settings in the menu</em>
    </td>
    <td align="center">
      <img src="assets/screenshot-settings.png" alt="AI Settings Dialog" width="400" /><br />
      <em>Configure your provider and model</em>
    </td>
  </tr>
</table>

## AI Frame

The AI Frame is a special canvas element that enables vision-based AI features.

<div align="center">
  <img src="assets/screenshot-aiframe-buttons.png" alt="AI Frame Buttons" height="120" />
</div>

| Button | Feature | Description |
|:------:|---------|-------------|
| 🪄 | **Diagram-to-Code** | Converts wireframe drawings to HTML/CSS |
| 🧠 | **Wireframe-to-Prompt** | Generates development prompts from designs |
| 👁️ | **Image Description** | Analyzes and describes images with AI vision |

<div align="center">
  <img src="assets/screenshot-image-describe.png" alt="Image Description Demo" width="800" /><br />
  <em>Image Description: AI analyzes photos and generates detailed descriptions</em>
</div>

## Quick Start

```bash
git clone https://github.com/iamthemediagit/excalidrawgrail.git
cd excalidrawgrail
yarn install
yarn start
```

Open `http://localhost:5173` and click **Menu > AI Settings** to configure.

## AI Configuration

### Option 1: Ollama (Self-Hosted, Free)

1. Install [Ollama](https://ollama.ai)
2. Pull a model: `ollama pull llama3.2`
3. For vision features: `ollama pull llava`
4. In ExcalidrawGrail: Menu > AI Settings > Select "Ollama"
5. Models are fetched automatically from your local Ollama instance

### Option 2: OpenAI

1. Get an API key from [OpenAI Platform](https://platform.openai.com)
2. Menu > AI Settings > Select "OpenAI"
3. Enter your API key
4. Recommended models: `gpt-4o` (vision), `gpt-4o-mini` (fast)

### Option 3: Anthropic Claude

1. Get an API key from [Anthropic Console](https://console.anthropic.com)
2. Menu > AI Settings > Select "Anthropic"
3. Enter your API key
4. Recommended: `claude-sonnet-4-20250514`

## Usage

### Text-to-Diagram

1. Press `Shift + A` or click the AI wand icon
2. Describe your diagram: *"A flowchart showing user authentication flow"*
3. AI generates Mermaid code, rendered as Excalidraw shapes

### Diagram-to-Code

1. Draw a wireframe inside an AI Frame
2. Click the magic wand icon [🪄] on the frame
3. AI analyzes the drawing and generates HTML/CSS in a preview iframe

### Wireframe-to-Prompt

1. Draw a wireframe inside an AI Frame
2. Click the brain icon [🧠] on the frame
3. AI generates a comprehensive development prompt with:
   - App overview and target users
   - Core features breakdown
   - Tech stack recommendations
   - File structure and components
   - Data models and API endpoints

### Image Description

1. Insert an image inside an AI Frame
2. Click the eye icon [👁️] on the frame
3. AI analyzes and describes the image with:
   - Visual description (subjects, objects, setting)
   - Colors and artistic style
   - Context and mood
   - Suggested tags

## Docker

### Development
```bash
docker compose up
```
Open `http://localhost:3000`

### Production
```bash
docker build -t excalidrawgrail .
docker run -p 80:80 excalidrawgrail
```

## Syncing with Upstream

ExcalidrawGrail is a fork. To get updates from the original Excalidraw:

### Setup (once)
```bash
git remote add upstream https://github.com/excalidraw/excalidraw.git
```

### Sync
```bash
git fetch upstream
git checkout master
git merge upstream/master
git push origin master
```

### Rebase feature branches
```bash
git checkout your-feature-branch
git rebase master
```

## Development

```bash
yarn test:typecheck  # TypeScript checks
yarn test:update     # Run tests
yarn fix             # Auto-fix linting
yarn build-node      # Build packages
```

## Architecture

```
excalidraw-app/
├── components/
│   ├── AI.tsx                       # Multi-provider AI logic
│   ├── AISettingsDialog.tsx         # Settings UI
│   ├── MagicFramePromptGenerator.tsx # Wireframe-to-prompt
│   └── AppMainMenu.tsx              # Menu with AI Settings
grail-patches/
├── voice/                           # Voice input patches
├── prompt-mode/                     # Prompt generation patches
└── apply-patches.sh                 # Postinstall patch script
packages/
├── excalidraw/             # Core editor
├── common/                 # Shared constants
└── ...
```

## Credits

Based on [Excalidraw](https://excalidraw.com) - the amazing open-source whiteboard.

## License

MIT
