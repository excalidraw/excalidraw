# Module 04 — React Patterns

**Time:** 4-6 hours
**Goal:** Learn *only* the React concepts this codebase uses. Not a full React course — a targeted primer.

---

## React in 10 Minutes

If you've never seen React:

```tsx
// A component is a function that returns JSX (HTML-like syntax)
function Greeting({ name }: { name: string }) {
  return <div>Hello, {name}</div>;
}

// Used like an HTML tag:
<Greeting name="Tushar" />
```

**Three things to know:**
1. Components are functions that return UI
2. Props are the function's arguments
3. When props or state change, the function re-runs and the UI updates

That's React. Everything else is optimization and patterns.

---

## The 6 React Concepts Used in Excalidraw

### 1. useState and State Updates

```tsx
const [count, setCount] = useState(0);
// count = current value
// setCount = function to update it (triggers re-render)

setCount(5);           // set to 5
setCount(c => c + 1);  // increment based on previous value
```

Excalidraw's `App.tsx` uses `this.setState()` (class component syntax) instead of hooks because the App component is a class component. Same concept, older API:

```typescript
// In App.tsx:
this.setState({
  activeTool: { type: "rectangle" },
  selectedElementIds: {},
});
```

### 2. useEffect (Side Effects)

```tsx
useEffect(() => {
  // runs after render
  renderStaticScene(canvas, elements);

  return () => {
    // cleanup (runs before next effect or unmount)
  };
}, [elements]); // only re-run when `elements` changes
```

The canvas components use `useEffect` to trigger rendering when props change. The dependency array `[elements]` is critical — it controls when the effect fires.

### 3. React.memo (Skip Re-renders)

```tsx
const StaticCanvas = React.memo(function StaticCanvas(props) {
  // ...
}, areEqual);  // custom comparison function
```

`React.memo` wraps a component so it only re-renders when its props change. The optional second argument is a custom comparison function.

**In Excalidraw** (`index.tsx:160`), the main `<Excalidraw>` component has an extensive `areEqual` function that does deep comparison of `UIOptions` and other nested props. This is because parent components often create new object references on every render:

```tsx
// This creates a NEW UIOptions object every render:
<Excalidraw UIOptions={{ canvasActions: { export: true } }} />

// React.memo with shallow comparison would always re-render (new object ≠ old object)
// The custom areEqual does deep comparison of the actual values
```

### 4. useRef (Stable References)

```tsx
const canvasRef = useRef<HTMLCanvasElement>(null);

// canvasRef.current = the actual DOM element
// Does NOT trigger re-renders when changed
```

Canvas elements are accessed via refs because you need the raw DOM node to call `getContext("2d")`.

### 5. useContext (Shared State Without Prop Drilling)

```tsx
// Create context:
const AppContext = createContext<App>(null);

// Provide it (high in the tree):
<AppContext.Provider value={app}>
  <DeepNestedChild />
</AppContext.Provider>

// Consume it (anywhere below the provider):
function DeepNestedChild() {
  const app = useContext(AppContext);
  // app is available without being passed through every intermediate component
}
```

Excalidraw has several contexts defined in `packages/excalidraw/context/`:
- `AppContext` — the App instance
- `AppPropsContext` — the props passed to `<Excalidraw>`
- `EditorInterfaceContext` — device/form-factor info
- `ExcalidrawContainerContext` — the container DOM element

### 6. Tunnels (tunnel-rat library)

Not a React built-in — a library pattern used to render content at a distant location in the tree:

```tsx
// Define a tunnel:
const MenuTunnel = tunnel();

// Send content INTO the tunnel (deep in the tree):
<MenuTunnel.In>
  <button>My Menu Button</button>
</MenuTunnel.In>

// Content comes OUT here (anywhere else in the tree):
<MenuTunnel.Out />
```

**Why?** The main menu content is defined by the consuming app (`excalidraw-app`) but must render inside the library's toolbar. Tunnels solve this without prop drilling through 10+ component layers.

Defined in `packages/excalidraw/context/tunnels.ts`:
```typescript
MainMenuTunnel
FooterCenterTunnel
WelcomeScreenMenuHintTunnel
WelcomeScreenToolbarHintTunnel
WelcomeScreenCenterTunnel
DefaultSidebarTriggerTunnel
```

---

## Jotai — The State Management Library

**File:** `packages/excalidraw/editor-jotai.ts` (19 lines — read the whole thing)

Jotai is an atom-based state management library. An atom is a single piece of state:

```typescript
import { atom } from "jotai";

const countAtom = atom(0);  // atom with initial value 0

// In a component:
const [count, setCount] = useAtom(countAtom);
```

**Why not just useState?** Atoms are *global* — any component can read/write them without prop drilling or context. And they're *granular* — changing one atom only re-renders components that use that specific atom.

**Excalidraw's twist — scoped isolation:**

```typescript
// editor-jotai.ts
const jotai = createIsolation();
export const { useAtom, useSetAtom, useAtomValue, useStore } = jotai;
```

`createIsolation()` (from `jotai-scope`) creates a separate Jotai store. This means the library's atoms don't conflict with the consuming app's atoms. The app layer has its own store in `excalidraw-app/app-jotai.ts`.

**ESLint rule:** The codebase has a lint rule banning direct `import { useAtom } from "jotai"`. You must import from `editor-jotai.ts` or `app-jotai.ts` to get the scoped version.

---

## Class Component vs Function Component

Most of Excalidraw uses function components with hooks. But `App.tsx` — the most important component — is a **class component**:

```typescript
class App extends React.Component<AppProps, AppState> {
  state: AppState = getDefaultAppState();

  setState(update: Partial<AppState>) { ... }

  handleCanvasPointerDown = (event: React.PointerEvent) => { ... };

  render() {
    return <canvas onPointerDown={this.handleCanvasPointerDown} />;
  }
}
```

**Why class?** Historical reasons — it was written before hooks existed. It works the same way conceptually:
- `this.state` = the current state (like `useState`)
- `this.setState()` = update state and re-render (like `setCount`)
- `this.props` = the component's inputs (like function arguments)
- Methods = event handlers

Don't let the class syntax throw you off. It's the same state-update-rerender cycle.

---

## What You Can Safely Ignore

| React concept | Used in Excalidraw? | Notes |
|--------------|---------------------|-------|
| Redux | No | Jotai instead |
| useReducer | No | — |
| Suspense / lazy loading | Minimal | Not architecturally important |
| Server components | No | This is client-only |
| Form libraries | No | — |
| CSS-in-JS | No | SCSS files |
| React Router | No | Single-page app, no routing |

---

## The Component Tree

```
<Excalidraw>                    packages/excalidraw/index.tsx
  └── EditorJotaiProvider       Scoped Jotai store
       └── InitializeApp        Locale + theme setup
            └── App             packages/excalidraw/components/App.tsx (CLASS component)
                 ├── LayerUI    The entire UI overlay (toolbar, menus, sidebars)
                 │    ├── FixedSideContainer  Top bar (tools, shape actions)
                 │    ├── Footer              Bottom bar
                 │    └── Sidebar             Properties panel
                 ├── StaticCanvas             Background elements
                 ├── InteractiveCanvas        Selection/handles/cursors
                 └── NewElementCanvas         Element being drawn
```

**Key insight:** `App.tsx` is the orchestrator. It holds the state, handles all pointer events, delegates rendering to the canvases, and delegates UI to `LayerUI`. Understanding `App.tsx` is understanding Excalidraw.

---

## Exercises

1. Read `packages/excalidraw/editor-jotai.ts` — all 19 lines. Understand what `createIsolation()` does.
2. Open `packages/excalidraw/index.tsx`. Find the `areEqual` function (~line 160). Read what props it compares and why.
3. Open `packages/excalidraw/context/tunnels.ts`. List all the tunnels. Then search for `MainMenuTunnel.In` in the codebase — where does content enter the tunnel?
4. Open `packages/excalidraw/components/App.tsx`. Don't try to read it all — just find:
   - The `state` type annotation (it's `AppState`)
   - The `render()` method (near the bottom)
   - One event handler (e.g., `handleCanvasPointerDown`)
5. Search for `useAtom` in the codebase — find 3 examples of atoms being used in components.

---

**Next:** [Module 05 — Element System](05-element-system.md)
