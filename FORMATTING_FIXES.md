# Prettier/ESLint Formatting Issues - Resolution Guide

## Issues Encountered

The following files had Prettier/ESLint formatting violations that needed to be fixed:

### 1. App.tsx - Nested Ternary Operator Formatting (Lines 401-406)

**Issue:** Nested ternary operator had incorrect indentation.

**Original Code:**
```typescript
const exportFormat = type === "EXPORT_SVG" ? "svg" :
                    type === "EXPORT_PNG" ? "png" : "clipboard";
```

**Fixed Code:**
```typescript
const exportFormat =
  type === "EXPORT_SVG"
    ? "svg"
    : type === "EXPORT_PNG"
    ? "png"
    : "clipboard";
```

**Key Points:**
- Break the assignment across multiple lines
- Align all ternary operators (? and :) at the same indentation level
- Each branch should be properly indented (2 spaces per level)

### 2. App.tsx - Missing Comma in Object (Line 450)

**Issue:** Missing comma after the `error` property value in error response object.

**Original Code:**
```typescript
error: error?.message || "Unknown error"
```

**Fixed Code:**
```typescript
error: error?.message || "Unknown error",
```

**Key Points:**
- Always add trailing commas in multi-line objects/arrays
- This applies even to the last property in an object

### 3. api-handler.ts - Long Variable Assignment (Line 110)

**Issue:** Long variable assignment needed line break.

**Original Code:**
```typescript
const versionNonce = element.versionNonce ?? Math.floor(Math.random() * 2 ** 31);
```

**Fixed Code:**
```typescript
const versionNonce =
  element.versionNonce ?? Math.floor(Math.random() * 2 ** 31);
```

**Key Points:**
- Break long assignments after the `=` operator
- Indent the expression on the next line (2 spaces)

### 4. api-handler.ts - Array Literal Formatting (Line 158)

**Issue:** Short array needed to be expanded to multiple lines.

**Original Code:**
```typescript
points: element.points ?? [[0, 0], [100, 0]],
```

**Fixed Code:**
```typescript
points: element.points ?? [
  [0, 0],
  [100, 0],
],
```

**Key Points:**
- When an array literal is expanded, each element goes on its own line
- Add trailing comma after the last element
- The closing bracket is on its own line

### 5. api-handler.ts - Long Ternary Expression (Lines 166-167)

**Issue:** Long property value with ternary expression needed line break.

**Original Code:**
```typescript
endArrowhead: element.endArrowhead ?? (element.type === "arrow" ? "arrow" : null),
```

**Fixed Code:**
```typescript
endArrowhead:
  element.endArrowhead ?? (element.type === "arrow" ? "arrow" : null),
```

**Key Points:**
- Break after the colon when the value is too long
- Indent the value expression (2 spaces)
- Keep the comma at the end of the line

## Prevention Tips

1. **Line Length:** Prettier enforces an 80-character line limit by default. If a line exceeds this, break it appropriately.

2. **Ternary Operators:** For nested ternaries, ensure all operators align at the same indentation level.

3. **Object Properties:** Always add trailing commas in multi-line objects and arrays.

4. **Array Literals:** When expanding arrays, ensure each element is on its own line with proper indentation.

5. **Run Before Committing:** Always run `yarn fix` before committing to automatically fix formatting issues:
   ```bash
   yarn fix
   ```

## Verification

To check for formatting issues without fixing them:
```bash
yarn format:check
```

To automatically fix all formatting issues:
```bash
yarn fix
```

## Files Modified

- `/Users/developer/excalidraw/excalidraw-app/App.tsx`
- `/Users/developer/excalidraw/excalidraw-app/api-handler.ts`
