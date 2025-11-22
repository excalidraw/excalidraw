# Unit Test Execution

## Overview
Unit tests verify individual components and services in isolation. The Excalidraw project uses Vitest as the test runner.

## Run Unit Tests

### 1. Execute All Unit Tests
```bash
# Run all tests once
yarn test

# Run with coverage report
yarn test:coverage

# Run with UI for interactive debugging
yarn test:ui
```

### 2. Run Specific Test Suites
```bash
# Test only AI services
yarn test packages/excalidraw/services/

# Test only AI components
yarn test packages/excalidraw/components/AI

# Test specific file
yarn test packages/excalidraw/services/AIConfigurationService.test.ts
```

### 3. Review Test Results
- **Expected**: All existing tests pass (new AI features don't have tests yet)
- **Test Coverage**: Check coverage report in `coverage/` directory
- **Test Report Location**: Console output and `coverage/index.html`

## Current Test Status

### Existing Tests
The Excalidraw codebase has extensive existing tests that should continue to pass:
- Element manipulation tests
- Scene rendering tests
- Action handler tests
- Utility function tests

### New AI Feature Tests
**Status**: Not yet implemented

The following test files should be created for comprehensive coverage:

#### Service Tests (Priority: High)
- `packages/excalidraw/services/AIConfigurationService.test.ts`
  - Test configuration storage and retrieval
  - Test provider validation
  - Test API key encryption/decryption

- `packages/excalidraw/services/LLMVisionService.test.ts`
  - Test provider adapter selection
  - Test request formatting
  - Test response parsing
  - Mock LLM API calls

- `packages/excalidraw/services/ImageProcessingService.test.ts`
  - Test image validation
  - Test base64 encoding
  - Test image resizing
  - Test format conversion

- `packages/excalidraw/services/MermaidValidationService.test.ts`
  - Test mermaid syntax validation
  - Test error detection
  - Test code sanitization

- `packages/excalidraw/services/ConversionOrchestrationService.test.ts`
  - Test conversion workflow
  - Test error handling
  - Test retry logic
  - Test state management

#### Component Tests (Priority: Medium)
- `packages/excalidraw/components/AIConfigurationDialog.test.tsx`
  - Test dialog rendering
  - Test provider tab switching
  - Test form validation
  - Test save/cancel actions

- `packages/excalidraw/components/ImageToMermaidDialog.test.tsx`
  - Test image upload
  - Test paste from clipboard
  - Test conversion trigger
  - Test error display

#### Integration Tests (Priority: Low)
- Test full conversion workflow
- Test state synchronization
- Test error recovery

## Test Implementation Guidelines

### Mock External Dependencies
```typescript
// Mock LLM API calls
vi.mock('../services/adapters/OpenAIAdapter', () => ({
  OpenAIAdapter: {
    convertImageToMermaid: vi.fn().mockResolvedValue('graph TD\nA-->B'),
  },
}));

// Mock file reading
vi.mock('browser-fs-access', () => ({
  fileOpen: vi.fn().mockResolvedValue(new File([''], 'test.png')),
}));
```

### Test Structure Example
```typescript
describe('AIConfigurationService', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
  });

  it('should save configuration', () => {
    const config = {
      provider: 'openai',
      apiKey: 'test-key',
      model: 'gpt-4-vision-preview',
    };
    
    AIConfigurationService.saveConfiguration(config);
    const saved = AIConfigurationService.getConfiguration();
    
    expect(saved.provider).toBe('openai');
    expect(saved.model).toBe('gpt-4-vision-preview');
  });

  it('should validate API key format', () => {
    expect(AIConfigurationService.validateApiKey('sk-test123')).toBe(true);
    expect(AIConfigurationService.validateApiKey('')).toBe(false);
  });
});
```

## Running Tests During Development

### Watch Mode
```bash
# Run tests in watch mode (re-runs on file changes)
yarn test --watch

# Watch specific directory
yarn test --watch packages/excalidraw/services/
```

### Debugging Tests
```bash
# Run with UI for debugging
yarn test:ui

# Run with verbose output
yarn test --reporter=verbose
```

## Fix Failing Tests

If tests fail:

1. **Review test output** - Identify which tests failed and why
2. **Check for breaking changes** - Ensure new code doesn't break existing functionality
3. **Update snapshots if needed** - If UI changes are intentional:
   ```bash
   yarn test -u
   ```
4. **Fix code issues** - Address any bugs revealed by tests
5. **Rerun tests** - Verify fixes:
   ```bash
   yarn test
   ```

## Test Coverage Goals

- **Services**: 80%+ coverage (critical business logic)
- **Components**: 60%+ coverage (UI interactions)
- **Utilities**: 90%+ coverage (pure functions)

## Next Steps

To add comprehensive test coverage for AI features:

1. Create test files for each service
2. Write unit tests for core functionality
3. Add component tests for dialogs
4. Mock external API calls
5. Achieve 80%+ coverage for new code
6. Run full test suite to ensure no regressions
