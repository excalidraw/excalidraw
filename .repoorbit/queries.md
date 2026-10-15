---
github-issue: https://github.com/excalidraw/excalidraw/issues/11389
---

## Summary

The tab synchronization feature reads and parses localStorage values without proper type validation, which could cause runtime errors, data inconsistency, or denial of service.

## Location

File: `excalidraw-app/data/tabSync.ts:13`

## Vulnerability Details

```tsx
const storageTimestamp = JSON.parse(localStorage.getItem(type) || "-1");
```

## Security Concerns

1. **Assumed JSON Number Format**: Assumes the stored value is always a valid JSON number
2. **No Error Handling**: If the stored value is malformed JSON, `JSON.parse` will throw
3. **No Type Validation**: If the parsed value is not a number, it will cause type errors
4. **External Manipulation**: localStorage can be modified by:
   - Malicious browser extensions
   - XSS attacks (if other vulnerabilities exist)
   - Direct manipulation via DevTools
   - Compromised local machine

## Attack Vectors

1. **Malformed JSON**:

```javascript
localStorage.setItem("someKey", "{broken json");
// Result: JSON.parse throws → app crash
```

2. **Wrong Type**:

```javascript
localStorage.setItem("timestamp_key", '"not a number"');
// Result: NaN used as timestamp → broken sync
```

3. **Object Injection**:

```javascript
localStorage.setItem("timestamp_key", '{"__proto__": {"isAdmin": true}}');
// Result: Potential prototype pollution
```

## Impact

- **Application Crashes**: Uncaught exceptions from `JSON.parse`
- **Data Inconsistency**: Broken tab synchronization across browser tabs
- **Denial of Service**: Repeated crashes make the app unusable
- **Type Confusion**: Unexpected types cause logic errors

## Severity

**MEDIUM** - Requires local manipulation of localStorage

## Affected Features

- Tab synchronization
- Real-time collaboration across tabs
- Local state persistence

## Suggested Fix

1. **Add Error Handling and Type Validation**:

```tsx
const getStorageTimestamp = (type: string): number => {
  try {
    const value = localStorage.getItem(type);
    if (value === null) return -1;

    const parsed = JSON.parse(value);

    // Validate it's a finite number
    if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
      console.warn(`Invalid timestamp in localStorage for key: ${type}`);
      return -1;
    }

    return parsed;
  } catch (error) {
    console.error(`Error reading localStorage for key ${type}:`, error);
    // Clear corrupted data
    localStorage.removeItem(type);
    return -1;
  }
};

const storageTimestamp = getStorageTimestamp(type);
```

2. **Initialize with Safe Defaults**:

```tsx
// When writing
try {
  localStorage.setItem(type, JSON.stringify(timestamp));
} catch (error) {
  console.error("Error writing to localStorage:", error);
}
```

3. **Add Validation for Write Operations**:

```tsx
function setStorageTimestamp(type: string, timestamp: number): void {
  if (!Number.isFinite(timestamp)) {
    console.error("Attempted to save invalid timestamp");
    return;
  }
  try {
    localStorage.setItem(type, JSON.stringify(timestamp));
  } catch (error) {
    console.error("Error writing to localStorage:", error);
  }
}
```

4. **Monitor for Corruption**: Log localStorage errors for security monitoring

## Best Practices

1. **Never Assume Storage Integrity**: Always validate localStorage data
2. **Clear on Corruption**: Remove corrupted entries to prevent repeated errors
3. **Use Schema Validation**: Validate data structure before use
4. **Error Boundaries**: Wrap localStorage operations in try-catch blocks

## Credits

Found during automated security review.

## Related Issues

#11385, #11386, #11387, #11388
