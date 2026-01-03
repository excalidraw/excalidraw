## Problem Analysis
The TypeScript error occurs because:
1. `FILE_EXTENSION` type is defined as `Exclude<keyof typeof MIME_TYPES, "binary">` in `filesystem.ts`
2. The `fileSave` function expects `extension` parameter to be of type `FILE_EXTENSION`
3. `"pdf"` is being passed as an extension but is not a key in `MIME_TYPES`
4. However, `"pdf"` is included in `EXPORT_IMAGE_TYPES` for PDF export functionality

## Solution Plan
1. **Update MIME_TYPES in constants.ts**: Add `pdf: "application/pdf"` to the MIME_TYPES constant
2. **Verify the fix**: Run TypeScript compilation to ensure the error is resolved
3. **Check for related issues**: Ensure all PDF export functionality works correctly
4. **Test the build**: Run the project's build process to confirm no other errors

## Implementation Steps
1. Edit `packages/common/src/constants.ts` to add PDF MIME type
2. Run `yarn tsc` to check for TypeScript errors
3. Run `yarn build` to verify the build process
4. Test the PDF export functionality to ensure it works as expected

## Expected Outcome
- TypeScript error resolved
- PDF export functionality works correctly
- No other errors introduced
- Type safety maintained throughout the codebase