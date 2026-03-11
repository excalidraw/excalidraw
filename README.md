---
title: "Excalidraw Fork: Luzmo + ACK Editing"
description: "A custom Excalidraw fork with embedded Luzmo Flex charts and ACK editing capabilities."
tags:
  - Flex
  - Editing
  - AI
  - React
author: "Luzmo"
image: "https://cdn.luzmo.com/showcases/flexcalidraw.gif"
---

# Excalidraw Fork: Luzmo + ACK Editing

This repository is a custom fork of Excalidraw built to showcase Luzmo's charting & editing possibilities (e.g. allowing  data-driven diagram workflows).

It combines Excalidraw's whiteboarding experience with Luzmo Flex chart integrations and editing capabilities.

## Features

- **Luzmo Flex chart integration** - edit and render Luzmo chart content inside the Excalidraw-based experience.
- **Diagram + analytics workflow** - Combine free-form canvas editing from Excalidraw with chart-backed context.
- **Undo / Redo** — Excalidraw provides robust undo/redo capabilities that let users iterate on diagrams and charts seamlessly.
- **Realtime collaboration** — Native Excalidraw realtime collaboration enables multiple users to co-edit diagrams, including Luzmo components.

## Tech Stack

- **[Excalidraw](https://github.com/excalidraw/excalidraw) (forked upstream)** - built in React
- **[@luzmo/react-embed](https://www.npmjs.com/package/@luzmo/react-embed)** — Flex SDK to dynamically render charts (`<luzmo-embed-viz-item>`)
- **[@luzmo/analytics-components-kit](https://www.npmjs.com/package/@luzmo/analytics-components-kit)** — used for editing charts
- **Luzmo REST API** — Retrieve dataset metadata (available columns); AI summary generation via `/aisummary`

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open the local app URL shown in your terminal.

4. For realtime collaboration, run `excalidraw-room` locally in a separate terminal:

```bash
git clone https://github.com/excalidraw/excalidraw-room.git
cd excalidraw-room
yarn
yarn start:dev
```

Then point your app's collaboration server configuration to your local `excalidraw-room` instance.

## Build

```bash
npm run build
npm run preview
```

## Acknowledgment

This project is built on top of the excellent [Excalidraw](https://github.com/excalidraw/excalidraw) open-source project.

Huge thanks to the Excalidraw team and contributors for creating and maintaining such a powerful, elegant whiteboarding foundation.