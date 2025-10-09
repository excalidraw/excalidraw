# Excalidraw Architecture Overview

## 🏗 Project Structure
excalidraw/
├── excalidraw-app/ # Main React Application
│ ├── src/
│ │ ├── app-language/ # Internationalization
│ │ ├── collab/ # Real-time Collaboration
│ │ │ ├── Collab.tsx # Main collaboration manager
│ │ │ ├── CollabError.tsx # Error handling
│ │ │ └── Portal.tsx # WebSocket communication
│ │ ├── components/ # UI Components
│ │ │ ├── App.tsx # Main app component
│ │ │ ├── AppFooter.tsx
│ │ │ ├── AppMainMenu.tsx
│ │ │ └── AI.tsx # AI features
│ │ ├── data/ # Data management
│ │ │ ├── FileManager.ts
│ │ │ ├── firebase.ts # Firebase integration
│ │ │ └── LocalData.ts
│ │ └── share/ # Sharing features
│ │ └── ShareDialog.tsx
├── packages/ # Shared Libraries
│ ├── @excalidraw/
│ │ ├── common/ # Common utilities
│ │ ├── element/ # Element types & logic
│ │ ├── excalidraw/ # Core package
│ │ └── utils/ # Utility functions
│ └── other shared packages...
├── public/ # Static assets
├── scripts/ # Build & development scripts
├── dev-docs/ # Development documentation
└── examples/ # Usage examples

text

## 🎯 Core Components

### Frontend Architecture
- **App.tsx** - Main application component handling routing and layout
- **Canvas System** - Drawing surface with event handlers
- **Toolbar** - Drawing tools and options
- **Collaboration Manager** - Real-time collaboration features

### Collaboration System (`collab/`)
- **Collab.tsx** - Manages WebSocket connections and peer synchronization
- **Portal.tsx** - Handles real-time data broadcasting via Socket.IO
- **CollabError.tsx** - Error handling for collaboration features
- **Firebase Integration** - For data persistence and file storage

### Data Flow
1. **User Input** → Toolbar/Canvas events
2. **State Update** → React state management (Jotai)
3. **Collaboration** → WebSocket broadcast to peers via Portal
4. **Persistence** → Firebase storage for scenes and files

## 🔧 Technical Stack

### Frontend
- **React 18** + **TypeScript** - UI framework
- **Vite** - Build tool and dev server
- **Jotai** - State management
- **Tailwind CSS** - Styling

### Real-time Collaboration
- **Socket.IO** - WebSocket communication
- **Firebase** - Backend services (Auth, Storage, Realtime DB)

### Development & Testing
- **Vitest** - Testing framework
- **ESLint** + **Prettier** - Code quality
- **Husky** - Git hooks

## 🚀 Key Features Architecture

### Drawing Engine
- **Rough.js** - Hand-drawn style rendering
- **Custom renderer** - Canvas-based drawing
- **Element system** - Shapes, text, images, arrows

### Collaboration Features
- **Room-based sessions** - `#room=parameter` URLs
- **Peer synchronization** - Real-time element updates
- **Conflict resolution** - Operational transform logic

### File Management
- **Local storage** - Browser persistence
- **Firebase storage** - Cloud backup
- **Export system** - PNG, SVG, JSON formats

## 📁 Key Directories Explained

### `excalidraw-app/src/`
- **Main application code** - React components and logic
- **Component-based architecture** - Reusable UI pieces
- **TypeScript throughout** - Full type safety

### `packages/@excalidraw/`
- **Shared libraries** - Used across different projects
- **Core logic** - Element handling, rendering, utilities
- **Modular design** - Independent packages

### `collab/` (Collaboration System)
- **Real-time features** - Multi-user editing
- **WebSocket management** - Connection handling
- **Error recovery** - Network issue handling

## 🔄 Data Flow Architecture
User Action → React Component → State Update →
↓
Collaboration Manager → WebSocket Broadcast →
↓
Other Peers → State Sync → UI Update
↓
Firebase Persistence ← Automatic Save

text

## 🛠 Development Workflow

### Running Locally
```bash
npm install
npm run start
Building for Production
bash
npm run build
Testing
bash
npm run test
🤝 Contribution Guidelines
When adding features:

React components → Place in excalidraw-app/src/components/

Collaboration features → Add to excalidraw-app/src/collab/

Shared utilities → Contribute to packages/@excalidraw/

Types → Update appropriate TypeScript definitions

