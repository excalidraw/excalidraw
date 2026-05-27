The **Language Detector API** is a client-side web API designed to identify the language of a given text string. By performing detection locally in the browser, it enhances user privacy and reduces the need for heavy external libraries or costly server-side calls.

## Key Use Cases

- **Translation Prep:** Identifying the source language before sending text to a translator.
- **Safety & Filtering:** Loading specific models for tasks like toxicity detection.
- **Accessibility:** Labeling content with the correct `lang` attribute for screen readers.
- **UI Localization:** Adjusting application interfaces based on the user's input language.

## Hardware & System Requirements

- **OS:** Windows 10/11, macOS 13+, Linux, or Chromebook Plus.
- **Storage:** 22 GB free space (model is removed if space drops below 10 GB).
- **RAM/CPU:** 16 GB RAM and 4+ CPU cores.
- **VRAM:** 4 GB+ if using a GPU.

## Implementation Guide

### 1. Model Management & User Activation

Check model availability before attempting to instantiate the detector or trigger download.

**MANDATORY:** Instantiating the language detector or triggering a model download with `LanguageDetector.create()` **MUST** be initiated by a user gesture (such as a button click) to prevent a `NotAllowedError` when the model is in a `downloadable` or `downloading` state.

```javascript
// Check if the model is available or downloadable
const availability = await LanguageDetector.availability();

if (availability !== 'unavailable') {
  button.addEventListener('click', async () => {
    const detector = await LanguageDetector.create({
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          console.log(`Downloaded ${e.loaded * 100}%`);
        });
      },
    });
  });
}
```

### 2. Running Detection

The API returns a ranked list of potential languages with a confidence score between `0.0` and `1.0`.

```javascript
const someUserText = 'Hallo und herzlich willkommen!';
const results = await detector.detect(someUserText);

for (const result of results) {
  // result.detectedLanguage (e.g., 'de')
  // result.confidence (e.g., 0.999)
  console.log(result.detectedLanguage, result.confidence);
}
```

Avoid using the detector on very short phrases or single words, as accuracy drops significantly.

## Security and Environment

- **Iframes:** Cross-origin iframes require an explicit Permissions Policy to access the API.
  ```html
  <iframe
    src="https://cross-origin.example.com/"
    allow="language-detector"
  ></iframe>
  ```
- **Web Workers:** The API is **not** currently available in Web Workers due to Permission Policy complexities.
- **Privacy:** No data is sent to Google or third parties during the detection process.

## Fallback Strategy

Language detector has limited availability.
Supported by: Chrome 138 (Jun 2025).
Unsupported in: Edge, Firefox, and Safari.

Before use, check if the `LanguageDetector` object is available in the global scope:

```javascript
if ('LanguageDetector' in self) {
  // The Language Detector API is supported.
} else {
  // Execute fallback strategy
}
```

If the `LanguageDetector` API is unsupported or availability checks return `'unavailable'`, you must gracefully fall back:
1. **Remote API Fallback**: Redirect the detection request to a server endpoint or a cloud API (such as the Vertex AI Gemini API) to identify the language.
2. **Graceful Degradation**: Disable language detection elements/buttons and inform the user that client-side detection is currently unsupported in this browser, preventing any unhandled exceptions or crashes.
