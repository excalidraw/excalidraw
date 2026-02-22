# Terraform Graph Viewer × Excalidraw Integration Outline

**Goal:** Replace the custom SVG/Canvas rendering in `Terraform-Graph-Viewer` with Excalidraw's canvas engine, turning Terraform plans into interactive, hand-drawn-style diagrams with full pan/zoom/edit capabilities.

---

## Table of Contents

1. [What You Have Now](#1-what-you-have-now)
2. [What You're Building](#2-what-youre-building)
3. [Architecture Overview](#3-architecture-overview)
4. [Phase 1 — Project Setup & Scaffold](#phase-1--project-setup--scaffold)
5. [Phase 2 — Backend: The Conversion API](#phase-2--backend-the-conversion-api)
6. [Phase 3 — The Transformer: Graph Data → Excalidraw Elements](#phase-3--the-transformer-graph-data--excalidraw-elements)
7. [Phase 4 — Frontend: Excalidraw Component Integration](#phase-4--frontend-excalidraw-component-integration)
8. [Phase 5 — Layout Algorithm](#phase-5--layout-algorithm)
9. [Phase 6 — Styling & Visual Design](#phase-6--styling--visual-design)
10. [Phase 7 — Interactivity: Resource Details & AI Insights](#phase-7--interactivity-resource-details--ai-insights)
11. [Phase 8 — Arrow Binding & Edge Routing](#phase-8--arrow-binding--edge-routing)
12. [Phase 9 — AWS Icons as Images](#phase-9--aws-icons-as-images)
13. [Phase 10 — Persistence & Export](#phase-10--persistence--export)
14. [Phase 11 — LangGraph AI Integration](#phase-11--langgraph-ai-integration)
15. [Phase 12 — Polish & Production](#phase-12--polish--production)
16. [File-by-File Migration Map](#file-by-file-migration-map)
17. [Key Excalidraw APIs You'll Use](#key-excalidraw-apis-youll-use)
18. [Data Flow Diagram](#data-flow-diagram)
19. [Risks & Gotchas](#risks--gotchas)
20. [Estimated Effort](#estimated-effort)

---

## 1. What You Have Now

### Current Frontend (`my-react-app/`)

```
SvgPage.jsx          — Main page: SVG element with manual pan/zoom via viewTransform
├── GraphNode.jsx    — <image> + <text> in SVG, AWS icon per resource type
├── RoughEdge.jsx    — Hand-drawn edge lines (roughjs)
├── RoughLine.jsx    — User-drawn annotation arrows (roughjs)
├── GraphControls.jsx— Toolbar: pan/draw/erase mode buttons
├── ContextMenu.jsx  — Right-click on node → Diff, Before/After state, AI insights
└── saveGraph.jsx    — Persist graph state to backend
```

**Hooks:**
- `useGraphData.js` — Fetches from `/api/mock` (or `/api/graph4`), transforms into `shapes{}` and `paths{}`
- `useGraphLayout.js` — d3-force simulation: `forceManyBody`, `forceLink`, `forceCenter`, `forceCollide`
- `useGraphInteraction.js` — Manual pan (translate), zoom (scale), drag nodes, draw arrows, eraser, context menus

**Current shape data model (per resource):**
```javascript
{
  id: "module.foo.aws_lambda_function.bar",       // address
  path: "module.foo.aws_lambda_function",          // path (without index)
  x: 120, y: 340,                                 // position
  size: 40,                                        // icon size (square)
  type: "aws_lambda_function",                     // resource type → icon
  edges_new: ["module.foo.aws_sqs_queue", ...],    // edges from DOT graph
  edges_existing: ["module.foo.aws_iam_role", ...],// edges from prior_state
  before_state: { ... },                           // terraform before values
  after_state: { ... },                            // terraform after values
  diff: { key: { before, after } },                // computed diffs
  AI: { Issues: [], Summary: "", ... },            // LangGraph analysis
  showLabel: false
}
```

### Current Backend

Your backend is **Express** (Node.js, port 8001). The original Flask backend is being retired — all pipeline logic has been ported to Node.js to keep the entire stack in JavaScript/TypeScript.

**Express** (`express-server/index.js`, port 8001) — **primary backend**:
- `POST /api/upload` — File upload endpoint (plan.json + graph.dot) → processes and returns graph4 JSON
- `GET /api/graph4` — Graph nodes enriched with LangGraph analysis
- `POST /api/query/langgraph` — Natural language queries about the plan
- `POST /api/save-layout` / `GET /api/load-layout` — Persist Excalidraw scene JSON
- Uses `@anthropic-ai/sdk` for AI calls
- `langgraph.js` (20KB) — JS port of the LangGraph routing/critique/refine logic
- `buildGraph.js` — Ported pipeline: DOT parse (ts-graphviz) → plan merge → diff → edges

**Flask** (`flask-server/app.py`, port 8000) — **legacy, being removed**:
- Had the full pipeline: DOT parse → plan merge → diff → AI enrichment → JSON
- Used pydot, networkx, SQLAlchemy — all ported to Node equivalents (ts-graphviz, graphology, better-sqlite3)
- No longer needed once Express pipeline is complete

### What's Limiting You

1. **Custom SVG rendering** — You manually manage viewTransform, hit testing, drag, zoom
2. **d3-force layout** — Force-directed layouts aren't great for dependency DAGs (overlapping, no hierarchy)
3. **No persistence of layout** — Positions are recalculated on every page load
4. **Limited interaction** — No undo/redo, no multi-select, no copy/paste, no export

---

## 2. What You're Building

An app where:
1. User uploads a Terraform plan JSON + DOT file (or the backend generates them)
2. Backend processes them into nodes + edges (your existing pipeline)
3. Frontend renders them as **Excalidraw elements** on the canvas
4. Each Terraform resource is a **rectangle** (or frame) with a label and optional AWS icon
5. Each dependency is an **arrow** with proper binding to source/target shapes
6. User can **pan, zoom, drag nodes, add annotations, undo/redo** — all free from Excalidraw
7. Right-click a resource → see diffs, state, AI insights in Excalidraw's sidebar
8. Graph is **auto-laid-out** using a DAG layout algorithm
9. User can **export** the diagram as PNG/SVG/JSON

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (React)                       │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │           <Excalidraw> Component                   │  │
│  │                                                   │  │
│  │  ┌─────────┐  ┌─────────┐  ┌──────────────────┐  │  │
│  │  │Rectangle│──│  Arrow  │──│    Rectangle     │  │  │
│  │  │ Lambda  │  │(binding)│  │   SQS Queue      │  │  │
│  │  └─────────┘  └─────────┘  └──────────────────┘  │  │
│  │                                                   │  │
│  │  Canvas: pan, zoom, drag, draw, undo, export      │  │
│  └───────────────────────────────────────────────────┘  │
│                         │                               │
│  ┌──────────────────────┴────────────────────────────┐  │
│  │              Transformer Layer                     │  │
│  │   graph4 JSON → ExcalidrawElementSkeleton[]       │  │
│  │   + dagre layout → x,y positions                  │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │ fetch                         │
└─────────────────────────┼───────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────┐
│               Backend (Express / Node.js)                │
│                                                         │
│  POST /api/upload    ← plan.json + graph.dot            │
│  GET  /api/graph4    → processed nodes + edges + AI     │
│  POST /api/query     → natural language answers         │
│  GET  /api/excalidraw → pre-transformed elements (opt)  │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 1 — Project Setup & Scaffold

### 1.1 Create a new frontend project (or modify existing)

You have two choices:

**Option A: New project alongside Excalidraw (recommended)**
```bash
mkdir terraform-excalidraw
cd terraform-excalidraw
npm create vite@latest . -- --template react
npm install @excalidraw/excalidraw
npm install dagre                    # DAG layout
npm install @anthropic-ai/sdk       # for AI/LangGraph features
```

**Option B: Add Excalidraw to your existing `my-react-app/`**
```bash
cd my-react-app
npm install @excalidraw/excalidraw
npm install dagre
```

Option A is cleaner because your current app has roughjs, d3-force, and custom SVG code that you'll be throwing away. Fresh start avoids conflicts.

### 1.2 Project structure

```
terraform-excalidraw/
├── src/
│   ├── App.jsx                     # Main app with Excalidraw
│   ├── ExcalidrawGraph.jsx         # Excalidraw wrapper component
│   ├── transformer/
│   │   ├── graphToElements.js      # graph4 JSON → ExcalidrawElementSkeleton[]
│   │   ├── layoutGraph.js          # dagre layout computation
│   │   ├── styleElements.js        # color-coding by action/type
│   │   └── iconRegistry.js         # AWS type → icon file mapping
│   ├── sidebar/
│   │   ├── ResourceSidebar.jsx     # Resource details panel
│   │   ├── DiffView.jsx            # Before/after diff display
│   │   └── AIInsights.jsx          # LangGraph analysis display
│   ├── hooks/
│   │   ├── useGraphData.js         # Fetch from backend
│   │   └── useExcalidrawAPI.js     # Excalidraw imperative API wrapper
│   ├── utils/
│   │   └── terraformUtils.js       # Resource type helpers, icon mapping
│   └── assets/
│       └── aws-icons/              # SVG icons for AWS resources
├── package.json
└── vite.config.js
```

### 1.3 Backend — Express server

Your Express backend handles all the heavy lifting. The full pipeline (DOT parsing, plan merging, diff computation, AI enrichment) runs in Node.js, keeping the entire stack in JavaScript/TypeScript. The main backend work is adding a file upload endpoint (Phase 2) and the processing pipeline (`buildGraph.js`).

---

## Phase 2 — Backend: The Conversion API

### 2.1 Add file upload endpoint

Currently your backend reads from hardcoded files (`planexisting-larger.json`, `graphexisting.dot`). Add an upload endpoint so users can supply their own files:

**`express-server/index.js` — new endpoint:**
```javascript
const multer = require("multer");
const os = require("os");
const path = require("path");
const fs = require("fs");

const upload = multer({ dest: os.tmpdir() });

/**
 * POST /api/upload
 * Accept two files:
 *   - plan.json (from `terraform show -json tfplan`)
 *   - graph.dot (from `terraform graph -plan=tfplan`)
 *
 * Process them and return the graph4-style JSON.
 */
app.post(
  "/api/upload",
  upload.fields([
    { name: "plan", maxCount: 1 },
    { name: "dot", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const planFile = req.files?.plan?.[0];
      const dotFile = req.files?.dot?.[0];

      if (!planFile || !dotFile) {
        return res
          .status(400)
          .json({ error: "Both 'plan' and 'dot' files are required" });
      }

      // Read uploaded files
      const planJson = JSON.parse(fs.readFileSync(planFile.path, "utf-8"));
      const dotString = fs.readFileSync(dotFile.path, "utf-8");

      // Run your processing pipeline (see 2.2 for implementation)
      const nodes = buildGraph3Nodes(planJson, dotString);

      // Cleanup temp files
      fs.unlinkSync(planFile.path);
      fs.unlinkSync(dotFile.path);

      res.json(nodes);
    } catch (err) {
      console.error("Upload processing error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);
```

### 2.2 Port the processing pipeline to Node.js

The original Flask `build_graph3_nodes` used Python libraries (pydot, networkx). Here are the Node equivalents:

| Python (Flask) | Node.js (Express) equivalent | npm package |
|----------------|------------------------------|-------------|
| `pydot` (DOT parsing) | `ts-graphviz` or `graphviz-dot-parser` | `ts-graphviz`, `dotparser` |
| `networkx` (graph ops) | `graphology` | `graphology` |
| `SQLAlchemy` (DB) | `better-sqlite3` or `prisma` | `better-sqlite3`, `prisma` |
| `json` (plan parsing) | Native `JSON.parse()` | built-in |

**`express-server/buildGraph.js` — ported pipeline:**
```javascript
const { parse } = require("ts-graphviz/ast");
const fs = require("fs");
const path = require("path");

/**
 * Main pipeline: take parsed plan + DOT string, return graph4-style JSON.
 *
 * @param {Object} planJson — parsed terraform show JSON
 * @param {string} dotString — raw DOT graph string
 * @returns {Object} graph4 nodes keyed by resource path
 */
function buildGraph3Nodes(planJson, dotString) {
  // 1. Parse DOT graph to get adjacency list
  const newEdges = getAdjacencyListFromDot(dotString);

  // 2. Extract resource nodes from plan JSON
  const nodes = loadPlanAndNodes(planJson);

  // 3. Merge DOT edges into nodes
  for (const [source, targets] of Object.entries(newEdges)) {
    if (nodes[source]) {
      nodes[source].edges_new = targets;
    }
  }

  // 4. Compute diffs (before vs after)
  for (const [key, node] of Object.entries(nodes)) {
    const resource = Object.values(node.resources || {})[0];
    if (resource?.change?.before && resource?.change?.after) {
      resource.change.diff = computeDiff(
        resource.change.before,
        resource.change.after
      );
    }
  }

  // 5. Add existing edges from prior_state references
  addExistingEdges(nodes, planJson);

  return nodes;
}

function getAdjacencyListFromDot(dotString) {
  // Parse DOT → extract edges
  // Using ts-graphviz/ast:
  const ast = parse(dotString);
  const edges = {};

  function walk(node) {
    if (node.type === "edge") {
      const source = node.targets[0]?.id;
      const target = node.targets[1]?.id;
      if (source && target) {
        if (!edges[source]) edges[source] = [];
        edges[source].push(target);
      }
    }
    if (node.children) node.children.forEach(walk);
  }

  walk(ast);
  return edges;
}

function loadPlanAndNodes(planJson) {
  const nodes = {};
  const resourceChanges = planJson.resource_changes || [];

  for (const rc of resourceChanges) {
    const path = rc.address;
    const modulePath = path.split(".").slice(0, -1).join(".");

    if (!nodes[modulePath]) {
      nodes[modulePath] = { resources: {}, edges_new: [], edges_existing: [] };
    }
    nodes[modulePath].resources[path] = {
      address: path,
      type: rc.type,
      change: rc.change,
    };
  }

  return nodes;
}

function computeDiff(before, after) {
  const diff = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      diff[key] = { before: before[key], after: after[key] };
    }
  }
  return diff;
}

module.exports = { buildGraph3Nodes };
```

### 2.3 Optional: Excalidraw elements endpoint

You could have the backend return pre-computed Excalidraw elements, but it's better to do the transformation on the frontend because:
- Layout depends on canvas size
- The Excalidraw element schema is complex and tied to the library version
- Frontend transformation is faster to iterate on

---

## Phase 3 — The Transformer: Graph Data → Excalidraw Elements

This is the **core** of the integration. You need to convert your graph4 JSON into `ExcalidrawElementSkeleton[]` that Excalidraw's `convertToExcalidrawElements()` can consume.

### 3.1 Understanding the data shapes

**Input (your graph4 response):**
```javascript
{
  "module.myapp.aws_lambda_function.processor": {
    "resources": {
      "module.myapp.aws_lambda_function.processor": {
        "address": "module.myapp.aws_lambda_function.processor",
        "type": "aws_lambda_function",
        "change": {
          "actions": ["update"],
          "before": { "function_name": "old-name", ... },
          "after": { "function_name": "new-name", ... },
          "diff": { "function_name": { "before": "old-name", "after": "new-name" } }
        }
      }
    },
    "edges_new": ["module.myapp.aws_sqs_queue"],
    "edges_existing": ["module.myapp.aws_iam_role"],
    "AI": {
      "Issues": ["Missing dead letter queue"],
      "Summary": "Lambda function with SQS trigger",
      "Recommendations": ["Add DLQ configuration"]
    }
  },
  // ... more resources
}
```

**Output (ExcalidrawElementSkeleton[]):**
```javascript
[
  // Rectangle for each resource
  {
    type: "rectangle",
    id: "module.myapp.aws_lambda_function.processor",
    x: 100,       // from dagre layout
    y: 200,       // from dagre layout
    width: 200,
    height: 80,
    strokeColor: "#e67e22",    // orange = update
    backgroundColor: "#fef3e2", // light orange fill
    fillStyle: "solid",
    roundness: { type: 3 },     // rounded corners
    label: {
      text: "aws_lambda_function\nprocessor",
      fontSize: 14,
    },
  },
  // Arrow for each edge
  {
    type: "arrow",
    x: 300,       // computed from layout
    y: 240,
    width: 150,
    height: 0,
    start: {
      id: "module.myapp.aws_lambda_function.processor",
      type: "rectangle",
    },
    end: {
      id: "module.myapp.aws_sqs_queue.input",
      type: "rectangle",
    },
    strokeColor: "#2ecc71",    // green = new edge
  },
]
```

### 3.2 The transformer function — `graphToElements.js`

```javascript
// src/transformer/graphToElements.js

import { convertToExcalidrawElements } from "@excalidraw/excalidraw";

/**
 * Convert graph4 backend response into Excalidraw elements.
 *
 * @param {Object} graphData — raw graph4 JSON from backend
 * @param {Object} layout — { nodePositions: Map<id, {x, y}>, dimensions: {width, height} }
 * @returns {{ elements: ExcalidrawElement[], metadata: Map<id, resourceData> }}
 */
export function graphToExcalidrawElements(graphData, layout) {
  const skeletons = [];
  const metadata = new Map();  // Store resource data for sidebar lookups

  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 80;

  // --- Pass 1: Create rectangles for each resource path ---
  for (const [path, nodeData] of Object.entries(graphData)) {
    const resources = nodeData.resources || {};
    const firstResource = Object.values(resources)[0];
    if (!firstResource) continue;

    const position = layout.nodePositions.get(path);
    if (!position) continue;

    const action = firstResource.change?.actions?.[0] || "no-op";
    const colors = getActionColors(action);

    skeletons.push({
      type: "rectangle",
      id: path,
      x: position.x,
      y: position.y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      strokeColor: colors.stroke,
      backgroundColor: colors.fill,
      fillStyle: "solid",
      strokeWidth: 2,
      roundness: { type: 3 },
      label: {
        text: formatResourceLabel(path, firstResource.type),
        fontSize: 13,
        fontFamily: 3,  // Cascadia/monospace
      },
    });

    // Store metadata for sidebar interaction
    metadata.set(path, {
      path,
      type: firstResource.type,
      resources,
      edges_new: nodeData.edges_new || [],
      edges_existing: nodeData.edges_existing || [],
      before: firstResource.change?.before,
      after: firstResource.change?.after,
      diff: firstResource.change?.diff,
      actions: firstResource.change?.actions,
      AI: nodeData.AI,
    });
  }

  // --- Pass 2: Create arrows for edges ---
  const seenEdges = new Set();

  for (const [sourcePath, nodeData] of Object.entries(graphData)) {
    // New edges (from DOT graph)
    for (const targetPath of nodeData.edges_new || []) {
      const edgeKey = `${sourcePath}→${targetPath}`;
      if (seenEdges.has(edgeKey)) continue;
      seenEdges.add(edgeKey);

      if (!graphData[targetPath]) continue;

      skeletons.push(createArrowSkeleton(
        sourcePath, targetPath, layout, NODE_WIDTH, NODE_HEIGHT,
        { strokeColor: "#2ecc71", strokeWidth: 2 }  // green for new
      ));
    }

    // Existing edges (from prior_state)
    for (const targetPath of nodeData.edges_existing || []) {
      const edgeKey = `${sourcePath}→${targetPath}`;
      if (seenEdges.has(edgeKey)) continue;
      seenEdges.add(edgeKey);

      if (!graphData[targetPath]) continue;

      skeletons.push(createArrowSkeleton(
        sourcePath, targetPath, layout, NODE_WIDTH, NODE_HEIGHT,
        { strokeColor: "#7f8c8d", strokeWidth: 1 }  // grey for existing
      ));
    }
  }

  // --- Convert skeletons to full Excalidraw elements ---
  const elements = convertToExcalidrawElements(skeletons);

  return { elements, metadata };
}
```

### 3.3 Helper functions

```javascript
function createArrowSkeleton(sourceId, targetId, layout, nodeW, nodeH, style) {
  const sourcePos = layout.nodePositions.get(sourceId);
  const targetPos = layout.nodePositions.get(targetId);
  if (!sourcePos || !targetPos) return null;

  return {
    type: "arrow",
    x: sourcePos.x + nodeW / 2,
    y: sourcePos.y + nodeH / 2,
    start: { id: sourceId, type: "rectangle" },
    end: { id: targetId, type: "rectangle" },
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    // Let Excalidraw auto-route the arrow via the binding system
  };
}

function getActionColors(action) {
  const ACTION_COLORS = {
    "create":   { stroke: "#27ae60", fill: "#eafaf1" },  // green
    "update":   { stroke: "#e67e22", fill: "#fef9e7" },  // orange
    "delete":   { stroke: "#e74c3c", fill: "#fdedec" },  // red
    "read":     { stroke: "#3498db", fill: "#ebf5fb" },  // blue
    "no-op":    { stroke: "#95a5a6", fill: "#f2f3f4" },  // grey
    "existing": { stroke: "#7f8c8d", fill: "#eaecee" },  // dark grey
    "external": { stroke: "#8e44ad", fill: "#f4ecf7" },  // purple
  };
  return ACTION_COLORS[action] || ACTION_COLORS["no-op"];
}

function formatResourceLabel(path, type) {
  // "module.myapp.aws_lambda_function.processor"
  // → "aws_lambda_function\nprocessor"
  const parts = path.split(".");
  const name = parts[parts.length - 1];
  const shortType = type || parts[parts.length - 2] || "";
  return `${shortType}\n${name}`;
}
```

### 3.4 The `convertToExcalidrawElements` API

Excalidraw provides this function (exported from `@excalidraw/excalidraw`) that converts "skeleton" objects into full elements with all required fields filled in (ids, versions, versionNonces, etc.).

**Key features of skeletons:**
- You only need to provide `type`, `x`, `y`, and the fields you care about
- For arrows: `start: { id, type }` and `end: { id, type }` auto-creates bindings
- For labels: `label: { text }` on a rectangle auto-creates bound text
- Everything else (version, seed, roughness, etc.) gets defaults

**Location in codebase:** `packages/element/src/transform.ts` → `convertToExcalidrawElements()`

---

## Phase 4 — Frontend: Excalidraw Component Integration

### 4.1 Basic Excalidraw setup — `ExcalidrawGraph.jsx`

```jsx
import { useState, useCallback, useRef, useEffect } from "react";
import { Excalidraw, Sidebar } from "@excalidraw/excalidraw";
import { graphToExcalidrawElements } from "../transformer/graphToElements";
import { computeLayout } from "../transformer/layoutGraph";
import ResourceSidebar from "../sidebar/ResourceSidebar";

export default function ExcalidrawGraph() {
  const excalidrawAPIRef = useRef(null);
  const [graphData, setGraphData] = useState(null);
  const [metadata, setMetadata] = useState(new Map());
  const [selectedResource, setSelectedResource] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 1. Fetch graph data from backend
  useEffect(() => {
    fetch("http://localhost:8001/api/graph4?mock=true")
      .then((res) => res.json())
      .then(setGraphData)
      .catch(console.error);
  }, []);

  // 2. When graph data arrives, compute layout and create elements
  useEffect(() => {
    if (!graphData || !excalidrawAPIRef.current) return;

    const layout = computeLayout(graphData);
    const { elements, metadata: meta } = graphToExcalidrawElements(graphData, layout);

    setMetadata(meta);
    excalidrawAPIRef.current.updateScene({ elements });
    excalidrawAPIRef.current.scrollToContent(elements, { fitToContent: true });
  }, [graphData]);

  // 3. Handle element selection → show resource details
  const handleChange = useCallback(
    (elements, appState) => {
      const selectedIds = appState.selectedElementIds || {};
      const selectedId = Object.keys(selectedIds).find(
        (id) => selectedIds[id] && metadata.has(id)
      );
      if (selectedId && selectedId !== selectedResource?.path) {
        setSelectedResource(metadata.get(selectedId));
        setSidebarOpen(true);
      }
    },
    [metadata, selectedResource]
  );

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Excalidraw
        excalidrawAPI={(api) => (excalidrawAPIRef.current = api)}
        onChange={handleChange}
        initialData={{
          appState: {
            viewBackgroundColor: "#f8f9fa",
            gridSize: 20,
          },
        }}
      >
        {/* Excalidraw's built-in Sidebar for resource details */}
        <Sidebar name="resource-details" docked={sidebarOpen}>
          <Sidebar.Header>Resource Details</Sidebar.Header>
          {selectedResource && (
            <ResourceSidebar resource={selectedResource} />
          )}
        </Sidebar>
      </Excalidraw>
    </div>
  );
}
```

### 4.2 What Excalidraw gives you for free

By just mounting `<Excalidraw>`, you instantly get:

| Feature | Was custom in your SVG app | Now free from Excalidraw |
|---------|---------------------------|-------------------------|
| Pan/zoom | `useGraphInteraction.js` (manual viewTransform) | Built-in (scroll/pinch/ctrl+wheel) |
| Drag elements | Manual mousedown/mousemove tracking | Built-in (multi-select too) |
| Undo/redo | Not implemented | Ctrl+Z / Ctrl+Y |
| Hand-drawn style | roughjs in RoughEdge/RoughLine | Built-in (RoughJS under the hood) |
| Export PNG/SVG | Not implemented | Built-in (menu → export) |
| Grid background | Manual SVG `<pattern>` | `gridSize: 20` in appState |
| Drawing tools | Manual draw/erase mode | Full toolbar (shapes, arrows, text, etc.) |
| Copy/paste | Not implemented | Built-in |
| JSON serialization | Manual saveGraph.jsx | `serializeAsJSON()` / `loadFromBlob()` |

### 4.3 Key Excalidraw props

```jsx
<Excalidraw
  // Get imperative API handle
  excalidrawAPI={(api) => { excalidrawAPIRef.current = api }}

  // Called on every change (elements, appState, files)
  onChange={(elements, appState, files) => { ... }}

  // Initial scene
  initialData={{
    elements: [],
    appState: { viewBackgroundColor: "#f8f9fa" },
    files: {},  // For AWS icons as images
  }}

  // Disable editing if you want view-only mode
  viewModeEnabled={false}

  // Custom UI extensions
  renderTopRightUI={() => <UploadButton />}

  // Sidebar as children
  children={<Sidebar>...</Sidebar>}
/>
```

### 4.4 Key imperative API methods

```javascript
const api = excalidrawAPIRef.current;

// Replace all elements
api.updateScene({ elements: newElements });

// Get current elements
const elements = api.getSceneElements();

// Scroll to fit all content
api.scrollToContent(elements, { fitToContent: true });

// Export
const blob = await api.exportToBlob({ mimeType: "image/png" });
const svg = await api.exportToSvg({ elements });

// Add image files (for AWS icons)
api.addFiles([{ id: "lambda-icon", dataURL: "data:image/svg+xml;base64,...", mimeType: "image/svg+xml" }]);

// Get/set app state
const state = api.getAppState();
api.updateScene({ appState: { ... } });
```

---

## Phase 5 — Layout Algorithm

### 5.1 Why not d3-force anymore

Your current `useGraphLayout.js` uses d3-force, which is a physics simulation (nodes repel, edges attract). This produces **organic-looking** layouts but:
- No hierarchy — Terraform dependencies are a DAG, they should flow top-to-bottom or left-to-right
- Overlapping — force layouts often overlap nodes when there are many
- Non-deterministic — different every time
- Slow convergence — the simulation runs for many ticks

### 5.2 Use dagre for DAG layout

[dagre](https://github.com/dagrejs/dagre) is purpose-built for directed acyclic graph layout. It produces clean, hierarchical layouts.

```bash
npm install dagre
```

### 5.3 `layoutGraph.js`

```javascript
import dagre from "dagre";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;
const RANK_SEP = 120;    // vertical spacing between ranks
const NODE_SEP = 40;     // horizontal spacing between nodes in same rank
const RANK_DIR = "TB";   // top-to-bottom (or "LR" for left-to-right)

/**
 * Compute x,y positions for each node using dagre DAG layout.
 *
 * @param {Object} graphData — graph4 response from backend
 * @returns {{ nodePositions: Map<string, {x,y}>, width: number, height: number }}
 */
export function computeLayout(graphData) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: RANK_DIR,
    ranksep: RANK_SEP,
    nodesep: NODE_SEP,
    marginx: 50,
    marginy: 50,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes
  const paths = Object.keys(graphData);
  for (const path of paths) {
    g.setNode(path, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // Add edges (deduplicated)
  const seenEdges = new Set();
  for (const [sourcePath, nodeData] of Object.entries(graphData)) {
    const allEdges = [
      ...(nodeData.edges_new || []),
      ...(nodeData.edges_existing || []),
    ];
    for (const targetPath of allEdges) {
      const key = `${sourcePath}→${targetPath}`;
      if (!seenEdges.has(key) && graphData[targetPath]) {
        seenEdges.add(key);
        g.setEdge(sourcePath, targetPath);
      }
    }
  }

  // Run layout
  dagre.layout(g);

  // Extract positions (dagre gives center coordinates, convert to top-left)
  const nodePositions = new Map();
  for (const path of paths) {
    const node = g.node(path);
    if (node) {
      nodePositions.set(path, {
        x: node.x - NODE_WIDTH / 2,
        y: node.y - NODE_HEIGHT / 2,
      });
    }
  }

  const graphBounds = g.graph();

  return {
    nodePositions,
    width: graphBounds.width || 1000,
    height: graphBounds.height || 1000,
  };
}
```

### 5.4 Alternative: ELK.js for more complex layouts

If you need more control (e.g., grouping by Terraform module, ports for edge connections, layered layout options), consider [elkjs](https://github.com/kieler/elkjs):

```bash
npm install elkjs
```

ELK is more powerful than dagre but has a steeper API. Start with dagre, upgrade if needed.

### 5.5 Grouping by Terraform module

You could use Excalidraw's **frames** to group resources by module:

```javascript
// For each unique module prefix, create a frame
const modules = new Map(); // "module.myapp" → [list of resource paths]

for (const path of Object.keys(graphData)) {
  const modulePath = path.split(".").slice(0, -2).join(".");
  if (!modules.has(modulePath)) modules.set(modulePath, []);
  modules.get(modulePath).push(path);
}

// Create frame skeletons
for (const [modulePath, children] of modules) {
  skeletons.push({
    type: "frame",
    id: `frame-${modulePath}`,
    name: modulePath,
    children: children,  // IDs of elements in this frame
    x: 0, y: 0,         // Position computed from children bounds
    width: 500,
    height: 400,
  });
}
```

---

## Phase 6 — Styling & Visual Design

### 6.1 Color-coding by Terraform action

```
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  🟢 CREATE       │   │  🟠 UPDATE       │   │  🔴 DELETE       │
│  aws_sqs_queue   │   │  aws_lambda_fn   │   │  aws_s3_bucket   │
│  my-queue        │   │  processor       │   │  old-bucket      │
└──────────────────┘   └──────────────────┘   └──────────────────┘

┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  ⚪ EXISTING     │   │  🔵 READ         │   │  🟣 EXTERNAL     │
│  aws_iam_role    │   │  data.aws_ami    │   │  aws_vpc.main    │
│  lambda-role     │   │  latest          │   │  (referenced)    │
└──────────────────┘   └──────────────────┘   └──────────────────┘
```

### 6.2 Edge styling

| Edge type | Color | Style |
|-----------|-------|-------|
| `edges_new` (from DOT graph) | `#27ae60` green | Solid, 2px |
| `edges_existing` (from prior_state) | `#7f8c8d` grey | Dashed or 1px |

In Excalidraw, you set `strokeStyle: "dashed"` or `strokeStyle: "solid"` on arrow elements.

### 6.3 Resource labels

Use Excalidraw's bound text (label inside rectangle):
```javascript
{
  type: "rectangle",
  label: {
    text: "aws_lambda_function\nprocessor",
    fontSize: 13,
    fontFamily: 3,  // Monospace (Cascadia Code)
  }
}
```

The label is auto-centered inside the rectangle and wraps if too long.

### 6.4 Legend

Add a frame in the corner with small colored rectangles as a legend:

```javascript
const LEGEND_X = 20;
const LEGEND_Y = 20;
const legendItems = [
  { label: "Create", color: "#27ae60" },
  { label: "Update", color: "#e67e22" },
  { label: "Delete", color: "#e74c3c" },
  { label: "Existing", color: "#7f8c8d" },
  { label: "External", color: "#8e44ad" },
];

legendItems.forEach((item, i) => {
  skeletons.push({
    type: "rectangle",
    x: LEGEND_X,
    y: LEGEND_Y + i * 30,
    width: 20,
    height: 20,
    backgroundColor: item.color,
    fillStyle: "solid",
    locked: true,
  });
  skeletons.push({
    type: "text",
    x: LEGEND_X + 30,
    y: LEGEND_Y + i * 30 + 3,
    text: item.label,
    fontSize: 12,
    locked: true,
  });
});
```

---

## Phase 7 — Interactivity: Resource Details & AI Insights

### 7.1 Selection → Sidebar

When the user clicks a resource rectangle, you detect it via `onChange`:

```javascript
const handleChange = useCallback((elements, appState) => {
  const selectedIds = Object.keys(appState.selectedElementIds || {})
    .filter((id) => appState.selectedElementIds[id]);

  // Find the first selected element that maps to a resource
  for (const id of selectedIds) {
    if (metadata.has(id)) {
      setSelectedResource(metadata.get(id));
      setSidebarOpen(true);
      return;
    }
  }
}, [metadata]);
```

### 7.2 ResourceSidebar component

```jsx
function ResourceSidebar({ resource }) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div style={{ padding: 16, fontFamily: "monospace" }}>
      {/* Header */}
      <h3>{resource.type}</h3>
      <code>{resource.path}</code>
      <div>Action: <Badge action={resource.actions?.[0]} /></div>

      {/* Tabs */}
      <TabBar active={activeTab} onChange={setActiveTab}
        tabs={["overview", "diff", "before", "after", "ai"]} />

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab resource={resource} />}
      {activeTab === "diff"     && <DiffView diff={resource.diff} />}
      {activeTab === "before"   && <JsonView data={resource.before} />}
      {activeTab === "after"    && <JsonView data={resource.after} />}
      {activeTab === "ai"       && <AIInsights ai={resource.AI} />}
    </div>
  );
}
```

### 7.3 DiffView component

Show before/after with color-coded changes, similar to your current ContextMenu's diff subItems:

```jsx
function DiffView({ diff }) {
  if (!diff || Object.keys(diff).length === 0) {
    return <p>No changes</p>;
  }

  return (
    <table>
      <thead>
        <tr><th>Property</th><th>Before</th><th>After</th></tr>
      </thead>
      <tbody>
        {Object.entries(diff).map(([key, { before, after }]) => (
          <tr key={key}>
            <td>{key}</td>
            <td style={{ color: "#e74c3c" }}>{JSON.stringify(before)}</td>
            <td style={{ color: "#27ae60" }}>{JSON.stringify(after)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### 7.4 AI Insights panel

```jsx
function AIInsights({ ai }) {
  if (!ai) return <p>No AI analysis available</p>;

  return (
    <div>
      {ai.Summary && <p><strong>Summary:</strong> {ai.Summary}</p>}

      {ai.Issues?.length > 0 && (
        <div>
          <h4>Issues</h4>
          <ul>
            {ai.Issues.map((issue, i) => (
              <li key={i} style={{ color: "#e74c3c" }}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {ai.Recommendations?.length > 0 && (
        <div>
          <h4>Recommendations</h4>
          <ul>
            {ai.Recommendations.map((rec, i) => (
              <li key={i} style={{ color: "#3498db" }}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

### 7.5 Double-click to query

Add a handler so double-clicking a resource opens a query dialog:

```javascript
// In ExcalidrawGraph.jsx
const handleDoubleClick = useCallback((element) => {
  const resource = metadata.get(element.id);
  if (resource) {
    // Open a dialog to ask a natural language question about this resource
    setQueryTarget(resource);
    setQueryDialogOpen(true);
  }
}, [metadata]);
```

---

## Phase 8 — Arrow Binding & Edge Routing

### 8.1 How binding works in Excalidraw (from your BINDING.md knowledge)

When you create an arrow skeleton with `start: { id: "some-rect-id" }`, the `convertToExcalidrawElements()` function:

1. Creates the arrow element
2. Finds the referenced rectangle by ID
3. Calls `bindLinearElementToElement()` to:
   - Calculate a `fixedPoint` (normalized 0-1 position on the rectangle)
   - Set `arrow.startBinding = { elementId, fixedPoint, mode: "orbit" }`
   - Add the arrow to `rectangle.boundElements`

This means: **when the user drags a resource rectangle, all connected arrows follow automatically**.

### 8.2 Edge types as Excalidraw arrow styles

```javascript
// New dependency edges (from graph plan)
{
  type: "arrow",
  strokeColor: "#27ae60",
  strokeWidth: 2,
  strokeStyle: "solid",
  startArrowhead: null,
  endArrowhead: "arrow",
  // ...binding info
}

// Existing dependency edges (from prior state)
{
  type: "arrow",
  strokeColor: "#95a5a6",
  strokeWidth: 1,
  strokeStyle: "dashed",
  startArrowhead: null,
  endArrowhead: "arrow",
  // ...binding info
}
```

### 8.3 Elbow arrows for clean routing (optional)

Excalidraw supports elbow (orthogonal) arrows that route around obstacles. These look cleaner for architecture diagrams:

```javascript
{
  type: "arrow",
  elbowed: true,  // orthogonal routing
  // ...
}
```

Elbow arrows use A* pathfinding to avoid overlapping with other elements. This is the `packages/element/src/elbowArrow.ts` system.

**Trade-off:** Elbow arrows are computationally expensive for large graphs. For 50+ resources, stick with regular arrows.

---

## Phase 9 — AWS Icons as Images

### 9.1 Strategy

Your current app uses SVG icons from `my-react-app/src/assets/`. In Excalidraw, you can use **image elements** to display icons.

### 9.2 Convert SVGs to data URLs

```javascript
// src/transformer/iconRegistry.js

// Import SVG files as URLs (Vite handles this)
import LambdaIcon from "../assets/aws-icons/Lambda.svg";
import SQSIcon from "../assets/aws-icons/SQS.svg";
import S3Icon from "../assets/aws-icons/S3.svg";
import IAMIcon from "../assets/aws-icons/IAM.svg";
// ... more icons

const ICON_MAP = {
  aws_lambda_function: LambdaIcon,
  aws_sqs_queue: SQSIcon,
  aws_s3_bucket: S3Icon,
  aws_iam_role: IAMIcon,
  aws_iam_role_policy: IAMIcon,
  // fallback handled in getIconForType()
};

const DEFAULT_ICON = "aws-generic";

/**
 * Load all AWS icons as Excalidraw BinaryFiles.
 * Call this once and pass to excalidrawAPI.addFiles()
 */
export async function loadIconFiles() {
  const files = {};

  for (const [type, svgUrl] of Object.entries(ICON_MAP)) {
    const response = await fetch(svgUrl);
    const svgText = await response.text();
    const dataURL = `data:image/svg+xml;base64,${btoa(svgText)}`;

    files[`icon-${type}`] = {
      id: `icon-${type}`,
      dataURL,
      mimeType: "image/svg+xml",
      created: Date.now(),
    };
  }

  return files;
}

export function getIconFileId(resourceType) {
  return ICON_MAP[resourceType] ? `icon-${resourceType}` : null;
}
```

### 9.3 Place icon images next to or inside resource rectangles

**Option A: Icon inside the rectangle (as a separate image element)**
```javascript
// For each resource, add a small image element positioned at top-left of rectangle
if (iconFileId) {
  skeletons.push({
    type: "image",
    x: position.x + 5,
    y: position.y + 5,
    width: 24,
    height: 24,
    fileId: iconFileId,
    locked: true,
  });
}
```

**Option B: Icon to the left, text to the right (simpler)**
Use the icon as a standalone image and the rectangle contains only text. This is simpler and avoids overlapping.

**Option C: Skip icons, use text-only rectangles (simplest to start)**
Start without icons. Add them later as polish. The color-coding by action is already very informative.

---

## Phase 10 — Persistence & Export

### 10.1 Save to JSON

Excalidraw has built-in serialization:

```javascript
import { serializeAsJSON } from "@excalidraw/excalidraw";

function handleSave() {
  const api = excalidrawAPIRef.current;
  const elements = api.getSceneElements();
  const appState = api.getAppState();
  const files = api.getFiles();

  const json = serializeAsJSON(elements, appState, files, "local");

  // Save to backend
  fetch("http://localhost:8001/api/save-layout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: json,
  });
}
```

### 10.2 Load from JSON

```javascript
import { loadFromBlob } from "@excalidraw/excalidraw";

async function handleLoad() {
  const response = await fetch("http://localhost:8001/api/load-layout");
  const blob = await response.blob();
  const data = await loadFromBlob(blob, null, null);

  excalidrawAPIRef.current.updateScene({
    elements: data.elements,
    appState: data.appState,
  });
}
```

### 10.3 Export to PNG/SVG

```javascript
// Export to PNG blob
const blob = await excalidrawAPIRef.current.exportToBlob({
  mimeType: "image/png",
  quality: 1,
});

// Export to SVG element
const svg = await excalidrawAPIRef.current.exportToSvg({
  elements: excalidrawAPIRef.current.getSceneElements(),
});
```

### 10.4 Backend save endpoint

```javascript
const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "layouts.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS layouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

app.post("/api/save-layout", (req, res) => {
  try {
    const stmt = db.prepare("INSERT INTO layouts (data) VALUES (?)");
    const result = stmt.run(JSON.stringify(req.body));
    res.json({ status: "saved", id: result.lastInsertRowid });
  } catch (err) {
    console.error("Save error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/load-layout", (req, res) => {
  try {
    const row = db.prepare("SELECT data FROM layouts ORDER BY id DESC LIMIT 1").get();
    if (!row) return res.status(404).json({ error: "No saved layout" });
    res.json(JSON.parse(row.data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

---

## Phase 11 — LangGraph AI Integration

### 11.1 Keep the existing `/api/query/langgraph` endpoint

Your Express backend already has a working LangGraph pipeline (using `@anthropic-ai/sdk` and `langgraph.js`). The frontend just needs a query UI.

### 11.2 Query panel in the sidebar

```jsx
function QueryPanel({ onResult }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState(null);

  const handleQuery = async () => {
    setLoading(true);
    const res = await fetch("http://localhost:8001/api/query/langgraph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    setAnswer(data.final_answer || data.synthesized_answer);
    setLoading(false);
  };

  return (
    <div>
      <textarea value={question} onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask about your infrastructure..." />
      <button onClick={handleQuery} disabled={loading}>
        {loading ? "Analyzing..." : "Ask"}
      </button>
      {answer && <div className="answer">{answer}</div>}
    </div>
  );
}
```

### 11.3 Highlight resources mentioned in AI answers

When the AI mentions specific resources, highlight them on the canvas:

```javascript
function highlightResources(answer, elements, api) {
  const resourcePaths = [...metadata.keys()];
  const mentioned = resourcePaths.filter((path) =>
    answer.toLowerCase().includes(path.toLowerCase())
  );

  // Update mentioned elements to have a highlight
  const updated = elements.map((el) =>
    mentioned.includes(el.id)
      ? { ...el, strokeColor: "#e74c3c", strokeWidth: 4 }
      : el
  );

  api.updateScene({ elements: updated });
}
```

---

## Phase 12 — Polish & Production

### 12.1 File upload UI

Add an upload button in `renderTopRightUI`:

```jsx
<Excalidraw
  renderTopRightUI={() => (
    <div style={{ display: "flex", gap: 8 }}>
      <label className="upload-btn">
        Upload Plan
        <input type="file" accept=".json" onChange={handlePlanUpload} hidden />
      </label>
      <label className="upload-btn">
        Upload Graph
        <input type="file" accept=".dot" onChange={handleDotUpload} hidden />
      </label>
      <button onClick={handleProcess}>Generate Diagram</button>
    </div>
  )}
/>
```

### 12.2 Loading state

Show a loading indicator while the backend processes files:

```jsx
{isLoading && (
  <div className="loading-overlay">
    <p>Processing Terraform plan...</p>
    <progress />
  </div>
)}
```

### 12.3 Error handling

Handle backend errors and display them in the UI.

### 12.4 Responsive layout

The Excalidraw component should fill the viewport. Handle window resize.

### 12.5 Dark mode

Excalidraw supports dark mode via `appState.theme: "dark"`. Add a toggle.

### 12.6 Performance for large graphs

For large Terraform plans (200+ resources):
- Use regular arrows instead of elbow arrows
- Consider collapsing modules into single nodes with expand/collapse
- Use `locked: true` on elements that shouldn't be moved
- Debounce the `onChange` handler

---

## File-by-File Migration Map

| Old File (current app) | Replacement | What changes |
|------------------------|-------------|-------------|
| `SvgPage.jsx` | `ExcalidrawGraph.jsx` | SVG → Excalidraw component |
| `GraphNode.jsx` | `transformer/graphToElements.js` | SVG `<image>` → Excalidraw rectangle skeleton |
| `RoughEdge.jsx` | `transformer/graphToElements.js` | roughjs edges → Excalidraw arrow skeletons |
| `RoughLine.jsx` | **Deleted** | User annotations are native in Excalidraw |
| `GraphControls.jsx` | **Deleted** | Excalidraw has its own toolbar |
| `ContextMenu.jsx` | `sidebar/ResourceSidebar.jsx` | Right-click menu → Excalidraw sidebar panel |
| `saveGraph.jsx` | Built-in `serializeAsJSON` | Manual save → Excalidraw JSON export |
| `useGraphData.js` | `hooks/useGraphData.js` | Keep as-is (just the fetch) |
| `useGraphLayout.js` | `transformer/layoutGraph.js` | d3-force → dagre |
| `useGraphInteraction.js` | **Deleted** | All interaction handled by Excalidraw |
| `contextMenuUtils.js` | `sidebar/DiffView.jsx` | Context menu items → sidebar tabs |

**Net effect:** You delete ~7 files of custom interaction/rendering code and replace them with ~6 files of data transformation code. The total frontend code should be **significantly smaller**.

---

## Key Excalidraw APIs You'll Use

| API | Import from | Purpose |
|-----|-------------|---------|
| `<Excalidraw>` component | `@excalidraw/excalidraw` | The main React component |
| `<Sidebar>` component | `@excalidraw/excalidraw` | Dockable side panel |
| `convertToExcalidrawElements()` | `@excalidraw/excalidraw` | Skeleton → full elements |
| `serializeAsJSON()` | `@excalidraw/excalidraw` | Export scene to JSON string |
| `loadFromBlob()` | `@excalidraw/excalidraw` | Import scene from blob |
| `exportToBlob()` | imperative API | Export to PNG/SVG blob |
| `exportToSvg()` | imperative API | Export to SVG element |
| `updateScene()` | imperative API | Replace/update elements |
| `scrollToContent()` | imperative API | Fit view to elements |
| `addFiles()` | imperative API | Load binary files (icons) |
| `getSceneElements()` | imperative API | Get current elements |
| `getAppState()` | imperative API | Get current UI state |

---

## Data Flow Diagram

```
User uploads plan.json + graph.dot
         │
         ▼
┌─────────────────────────────┐
│  POST /api/upload           │
│  Express backend (Node.js)  │
│                             │
│  1. parse DOT (ts-graphviz) │
│  2. load plan JSON          │
│  3. build edges (BFS)       │
│  4. compute diffs           │
│  5. add existing edges      │
│  6. LangGraph AI            │
│  7. return graph4 JSON      │
└───────────┬─────────────────┘
            │ JSON response
            ▼
┌────────────────────────────────────────────────────┐
│  Frontend: transformer/                             │
│                                                    │
│  1. layoutGraph.js    → dagre computes x,y         │
│  2. graphToElements.js → skeleton[] for each       │
│     resource (rectangle) and edge (arrow)          │
│  3. convertToExcalidrawElements(skeletons)          │
│     → full ExcalidrawElement[] with bindings        │
│  4. iconRegistry.js   → load AWS icon files        │
└───────────┬────────────────────────────────────────┘
            │ elements[] + files{}
            ▼
┌────────────────────────────────────────────────────┐
│  <Excalidraw>                                       │
│                                                    │
│  api.updateScene({ elements })                     │
│  api.addFiles(iconFiles)                           │
│  api.scrollToContent(elements, { fitToContent })   │
│                                                    │
│  User interacts: pan, zoom, drag, select, annotate │
│                                                    │
│  onChange → detect selection → show sidebar         │
│  Sidebar: Diff, Before/After, AI Insights, Query   │
└────────────────────────────────────────────────────┘
```

---

## Risks & Gotchas

### 1. `convertToExcalidrawElements` is a library internal

When importing from the npm package `@excalidraw/excalidraw`, it's a **public export** (listed in `packages/excalidraw/index.tsx`). It's safe to use. But the skeleton format isn't documented in detail — rely on the type definitions (`ExcalidrawElementSkeleton` in `transform.ts`).

### 2. Arrow binding requires IDs to match

When you set `start: { id: "some-id" }` on an arrow skeleton, that ID must match an existing element in the same `skeletons[]` array. If the element doesn't exist, the binding will fail silently.

**Fix:** Always generate rectangle skeletons before arrow skeletons, and validate that both endpoints exist.

### 3. Large graphs (200+ nodes) may be slow

Excalidraw renders every element on a canvas. 200 rectangles + 300 arrows + text labels = ~700 elements. This is fine for Excalidraw, but:
- Avoid `elbowed: true` on arrows for large graphs (expensive routing)
- Use `locked: true` to prevent accidental edits to infrastructure elements
- Consider collapsing module groups

### 4. Excalidraw `onChange` fires on every interaction

The callback fires on **every** mouse move during drag, zoom, etc. Debounce your sidebar update logic:

```javascript
const debouncedHandleChange = useMemo(
  () => debounce((elements, appState) => {
    // selection detection logic
  }, 100),
  [metadata]
);
```

### 5. Image elements require `addFiles()` first

You can't just set `fileId: "my-icon"` on an image element — you must first call `api.addFiles()` with the actual image data. Do this once when the component mounts, before creating elements.

### 6. Element IDs must be unique

Excalidraw uses element IDs extensively. Your Terraform resource paths (like `module.myapp.aws_lambda_function.processor`) contain dots, which is fine — Excalidraw IDs are just strings. But make sure they're unique across all elements (rectangles, arrows, text, images).

**Tip:** Use the resource path as-is for rectangles. For arrows, use `arrow-${source}→${target}`. For images, use `icon-${path}`.

### 7. The npm package vs the source repo

You're currently in the **source repo** of Excalidraw. For your Terraform app, you'd use the **npm package** `@excalidraw/excalidraw`. The APIs are the same but the import paths differ:
- Source repo: `import { ... } from "@excalidraw/element"` (internal packages)
- npm package: `import { ..., convertToExcalidrawElements } from "@excalidraw/excalidraw"` (all re-exported)

### 8. React version compatibility

Your current `my-react-app` uses React 19. Excalidraw's npm package should be compatible, but test early. If there are issues, pin to the React version Excalidraw specifies in its `peerDependencies`.

---

## Estimated Effort

| Phase | What | Effort |
|-------|------|--------|
| Phase 1 | Project setup, install Excalidraw + dagre | 1 hour |
| Phase 2 | Backend upload endpoint, refactor file paths | 2 hours |
| Phase 3 | Transformer: graphToElements.js | 4-6 hours |
| Phase 4 | ExcalidrawGraph.jsx basic integration | 2-3 hours |
| Phase 5 | Dagre layout | 2-3 hours |
| Phase 6 | Color-coding, styling, legend | 2 hours |
| Phase 7 | Sidebar: resource details, diff, AI | 4-6 hours |
| Phase 8 | Arrow binding tweaks | 2 hours |
| Phase 9 | AWS icons as images | 2-3 hours |
| Phase 10 | Persistence & export | 2 hours |
| Phase 11 | LangGraph query UI | 2-3 hours |
| Phase 12 | Polish, error handling, dark mode | 3-4 hours |
| **Total** | | **~28-37 hours** |

### Recommended build order

1. **Get Excalidraw rendering on screen** (Phase 1 + 4) — 3 hours
2. **Show rectangles from mock data** (Phase 3 basics + 5) — 5 hours
3. **Add arrows with bindings** (Phase 3 + 8) — 4 hours
4. **Add sidebar with resource details** (Phase 7) — 5 hours
5. **Color-coding and styling** (Phase 6) — 2 hours
6. **File upload** (Phase 2 + 12) — 4 hours
7. **Icons, persistence, AI, polish** (Phase 9-12) — rest

You should have a working prototype with rectangles + arrows + sidebar after **~17 hours of focused work**.
