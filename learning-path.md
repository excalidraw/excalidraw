# Excalidraw Learning Path

A structured curriculum for understanding the Excalidraw codebase. Written for someone who understands programming and state management but is **not** a React developer.

**Estimated total time:** ~120 hours (3 weeks full-time, or 2-3 months at ~10 hrs/week)

---

## How to Use This Guide

Each module builds on the previous ones. Don't skip ahead — later modules assume you've internalized earlier material. Each module links to a detailed document in the `learning-path/` folder.

For every module:
1. Read the guide first to understand *what* you're looking at and *why*
2. Open the listed files and read them in order
3. Do the exercises at the end of each module
4. Only move on when you can explain the concepts without looking at the code

---

## The Roadmap

```
Week 1                    Week 2                    Week 3
┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
│ 01 Prerequisites  │    │ 05 Element System │    │ 09 Binding &      │
│    (2-3 hours)    │    │    (6-8 hours)    │    │    Arrows         │
│                   │    │                   │    │    (15-20 hours)  │
│ 02 Math Layer     │    │ 06 State Mgmt     │    │                   │
│    (4-6 hours)    │    │    (6-8 hours)    │    │ 10 Collaboration  │
│                   │    │                   │    │    (15-20 hours)  │
│ 03 Canvas         │    │ 07 Rendering      │    │                   │
│    Fundamentals   │    │    Engine         │    │ 11 Data           │
│    (4-6 hours)    │    │    (8-10 hours)   │    │    Persistence    │
│                   │    │                   │    │    (4-6 hours)    │
│ 04 React Patterns │    │ 08 Text System    │    │                   │
│    (4-6 hours)    │    │    (6-8 hours)    │    │ 12 Testing        │
│                   │    │                   │    │    (3-4 hours)    │
└───────────────────┘    └───────────────────┘    │                   │
                                                  │ 13 Debugging      │
                                                  │    (2-3 hours)    │
                                                  └───────────────────┘
```

---

## Module Index

### Week 1 — Foundations

| # | Module | Time | What You'll Learn |
|---|--------|------|-------------------|
| [01](learning-path/01-prerequisites.md) | Prerequisites | 2-3h | External knowledge you need before touching the code |
| [02](learning-path/02-math-layer.md) | Math Layer | 4-6h | Points, vectors, curves, branded types — the geometric foundation |
| [03](learning-path/03-canvas-fundamentals.md) | Canvas Fundamentals | 4-6h | Canvas 2D API, transforms, the coordinate pipeline |
| [04](learning-path/04-react-patterns.md) | React Patterns | 4-6h | Only the React concepts this codebase actually uses |

### Week 2 — Core Systems

| # | Module | Time | What You'll Learn |
|---|--------|------|-------------------|
| [05](learning-path/05-element-system.md) | Element System | 6-8h | Types, mutation, versioning, the immutable-style pattern |
| [06](learning-path/06-state-management.md) | State Management | 6-8h | AppState, Jotai atoms, the action system, undo/redo |
| [07](learning-path/07-rendering-engine.md) | Rendering Engine | 8-10h | 3-layer canvas, RoughJS, shape caching, the render pipeline |
| [08](learning-path/08-text-system.md) | Text System | 6-8h | Measurement, wrapping, bound text, WYSIWYG editing |

### Week 3 — Advanced Systems

| # | Module | Time | What You'll Learn |
|---|--------|------|-------------------|
| [09](learning-path/09-binding-and-arrows.md) | Binding & Arrows | 15-20h | Arrow routing, focus points, elbow A* pathfinding |
| [10](learning-path/10-collaboration.md) | Collaboration | 15-20h | Real-time sync, reconciliation, fractional indexing |
| [11](learning-path/11-data-persistence.md) | Data Persistence | 4-6h | JSON/binary formats, schema migrations, encryption |
| [12](learning-path/12-testing.md) | Testing | 3-4h | Vitest patterns, test utilities, writing your first test |
| [13](learning-path/13-debugging.md) | Debugging | 2-3h | Debug globals, visual debugging, common pitfalls |

---

## Difficulty Curve

```
Difficulty
    ▲
    │                                          ┌─────────┐
    │                                     ┌────┤  Collab  │
    │                               ┌─────┤    │  System  │
    │                          ┌────┤Bind │    └─────────┘
    │                     ┌────┤ing &│    │
    │                ┌────┤Text│Arrow│    │
    │           ┌────┤Rend│Sys │    │    │
    │      ┌────┤Stat│erer│    │    │    │
    │ ┌────┤Elem│Mgmt│    │    │    │    │
    │ │Canv│Syst│    │    │    │    │    │
    │ │as  │em  │    │    │    │    │    │
    │─┤Math│    │    │    │    │    │    │
    │ │    │    │    │    │    │    │    │
    └─┴────┴────┴────┴────┴────┴────┴────┴──► Modules
      02   03   05   06   07   08   09   10
```

---

## Key Files You'll Read (In Order)

These are the files you'll encounter across all modules, listed by priority:

**Must-read (understand every line):**
```
packages/math/src/point.ts                    234 lines
packages/math/src/vector.ts                   161 lines
packages/element/src/types.ts                 435 lines
packages/element/src/newElement.ts            200 lines
packages/element/src/mutateElement.ts         200 lines
packages/excalidraw/appState.ts               400 lines
packages/excalidraw/editor-jotai.ts            19 lines
packages/excalidraw/history.ts                250 lines
```

**Must-read (understand the structure, skim the details):**
```
packages/element/src/bounds.ts                400 lines
packages/element/src/shape.ts                 264 lines
packages/element/src/renderElement.ts        1128 lines
packages/excalidraw/renderer/staticScene.ts   503 lines
packages/element/src/textElement.ts           530 lines
packages/element/src/textWrapping.ts          570 lines
packages/element/src/fractionalIndex.ts       447 lines
packages/excalidraw/data/reconcile.ts         200 lines
```

**Read when you need them (reference material):**
```
packages/element/src/binding.ts              2880 lines
packages/element/src/elbowArrow.ts           2297 lines
packages/element/src/linearElementEditor.ts  1000+ lines
packages/excalidraw/renderer/interactiveScene.ts
packages/excalidraw/components/App.tsx
excalidraw-app/collab/Collab.tsx
```

---

## One Rule

**Don't try to understand the whole repo at once.** Pick one data flow (e.g., "what happens when I draw a rectangle") and trace it end to end. Then pick another. After 10-15 of these traces, the architecture clicks.

The detailed modules start here: [01 — Prerequisites](learning-path/01-prerequisites.md)
