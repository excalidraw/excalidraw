# Module 12 — Testing

**Time:** 3-4 hours
**Goal:** Understand the test setup, patterns, and how to write your first test.

---

## Framework

- **Vitest 3.x** — test runner (Jest-compatible API)
- **jsdom** — browser environment simulation
- **@testing-library** — React component testing utilities
- **vitest-canvas-mock** — canvas 2D context mock

---

## Running Tests

```bash
yarn test:app                   # run all tests
yarn test:update                # run tests + update snapshots
yarn test:app -- --watch        # watch mode
yarn test:app -- path/to/file   # run specific test file
yarn test:coverage              # with coverage report
```

---

## Test Setup

**File:** `setupTests.ts` (in repo root)

This runs before every test:

1. **Canvas mock** — `vitest-canvas-mock` provides a fake `CanvasRenderingContext2D`
2. **IndexedDB mock** — `fake-indexeddb` for library/storage tests
3. **FontFace polyfill** — mocks `document.fonts` API
4. **Window polyfills** — `matchMedia`, `setPointerCapture`, `ResizeObserver`
5. **Root div** — creates `<div id="root">` for React mounting
6. **Console error wrapper** — suppresses noisy `act()` warnings

---

## Test Utilities

**File:** `packages/excalidraw/tests/test-utils.ts`

### render()

Mounts the Excalidraw component in a test environment:

```typescript
const { container } = await render(
  <Excalidraw
    initialData={{
      elements: [/* ... */],
      appState: { /* ... */ },
    }}
  />
);
```

### The `h` global (test handle)

After `render()`, the global `h` object gives access to internals:

```typescript
h.elements          // current elements array
h.state             // current AppState
h.app               // App instance
h.setState(update)  // update AppState
```

### API helpers

```typescript
// Create elements for testing:
const rect = API.createElement({
  type: "rectangle",
  x: 100,
  y: 100,
  width: 200,
  height: 150,
});

// Simulate pointer events:
Pointer.click(100, 100);
Pointer.down(100, 100);
Pointer.move(200, 200);
Pointer.up(200, 200);

// Simulate keyboard:
Keyboard.keyDown("Delete");
Keyboard.keyDown("z", { ctrlKey: true });  // undo

// Simulate drag-drop:
API.drop(file);
```

---

## Test Patterns

### Pattern 1: State assertion

```typescript
it("should set export background", async () => {
  await render(
    <Excalidraw
      initialData={{ appState: { exportBackground: true } }}
    />
  );

  await waitFor(() => {
    expect(h.state.exportBackground).toBe(true);
  });
});
```

### Pattern 2: Element manipulation

```typescript
it("should delete selected element", async () => {
  const rect = API.createElement({ type: "rectangle" });
  await render(<Excalidraw initialData={{ elements: [rect] }} />);

  // Select the element
  h.setState({ selectedElementIds: { [rect.id]: true } });

  // Press delete
  Keyboard.keyDown("Delete");

  // Verify deleted
  expect(h.elements[0].isDeleted).toBe(true);
});
```

### Pattern 3: Pointer interaction

```typescript
it("should create rectangle on drag", async () => {
  await render(<Excalidraw />);

  // Select rectangle tool
  h.setState({
    activeTool: { type: "rectangle", locked: false },
  });

  // Draw rectangle
  Pointer.down(100, 100);
  Pointer.move(300, 250);
  Pointer.up(300, 250);

  // Verify element created
  const rect = h.elements[h.elements.length - 1];
  expect(rect.type).toBe("rectangle");
  expect(rect.width).toBeGreaterThan(0);
  expect(rect.height).toBeGreaterThan(0);
});
```

### Pattern 4: Snapshot testing

```typescript
it("should match snapshot", async () => {
  await render(<Excalidraw />);
  expect(h.elements).toMatchSnapshot();
});
```

Run `yarn test:update` to regenerate snapshots after intentional changes.

### Pattern 5: Pure element tests (no React)

**File:** `packages/element/src/__tests__/`

For logic that doesn't need the full app:

```typescript
import { convertToExcalidrawElements } from "../transform";

describe("Transform", () => {
  it("should generate id", () => {
    const elements = [{ type: "rectangle", x: 100, y: 100 }];
    const result = convertToExcalidrawElements(elements);
    expect(result[0].id).toBeDefined();
  });
});
```

These tests are faster because they don't mount React components.

---

## Async Patterns

Many test assertions need `waitFor` because state updates are asynchronous:

```typescript
// WRONG — state may not have updated yet:
h.setState({ activeTool: { type: "rectangle" } });
expect(h.state.activeTool.type).toBe("rectangle");

// RIGHT — wait for the update:
h.setState({ activeTool: { type: "rectangle" } });
await waitFor(() => {
  expect(h.state.activeTool.type).toBe("rectangle");
});
```

---

## Where Tests Live

```
packages/excalidraw/tests/          # App-level tests
packages/element/src/__tests__/     # Element logic tests
packages/math/src/__tests__/        # Math tests (if any)
excalidraw-app/tests/               # App-specific integration tests
```

---

## Exercises

1. Run `yarn test:app` — watch the output. Note how many tests exist.
2. Read one test file in `packages/excalidraw/tests/` — pick the shortest one. Understand the setup and assertion pattern.
3. Write a test: create a rectangle, verify its properties, change its color via `h.setState`, verify the change.
4. Read `test-utils.ts` — find `render()` and understand what it sets up.
5. Run a single test file: `yarn test:app -- packages/excalidraw/tests/appState.test.tsx`

---

**Next:** [Module 13 — Debugging](13-debugging.md)
