The **Translator API** allows developers to perform client-side text translation using built-in AI models in Chrome. This approach eliminates the need for cloud-based translation services for ephemeral content, reducing costs and improving privacy by keeping data on the user's device.


## Prerequisites & Requirements

### Browser Support

- **Chrome:** Version 138+ (Desktop only).
- **Not Supported:** Mobile (Android/iOS), Edge, Firefox, Safari.

### Hardware Requirements

To run Gemini Nano and associated models, the system needs:

- **Operating System:** Windows 10/11, macOS 13+, Linux, or ChromeOS (Chromebook
  Plus).
- **Storage:** At least **22 GB** free on the Chrome profile volume.
- **Memory/CPU:** 16 GB+ RAM and 4+ CPU cores.
- **GPU:** 4 GB+ VRAM (Mandatory for Prompt API with audio).
- **Network:** Required only for the initial download of language packs/models.

## Implementation & Code Samples

### 1. Checking Availability & Downloading Models

**Mandatory Options Passing:** You must pass the identical configuration options object to both `Translator.availability(options)` and `Translator.create(options)`.

**Mandatory Progress Monitoring:** You MUST implement a monitor for model download progress by providing a `monitor(m)` callback to `Translator.create()` and adding a listener for the `downloadprogress` event.

**User Gesture Requirement:** When `availability` is `'downloadable'`, triggering the model download via `Translator.create()` requires a user gesture (such as a button click listener context). Unconditional page-load calls will trigger a `NotAllowedError`.

```javascript
const options = {
  sourceLanguage: 'es',
  targetLanguage: 'fr',
};

const availability = await Translator.availability(options);

if (availability === 'available' || availability === 'downloadable') {
  // A user gesture is strictly required to trigger create when downloadable
  document.getElementById('start-translation-btn').addEventListener('click', async () => {
    const translator = await Translator.create({
      ...options,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          console.log(`Downloaded ${Math.round(e.loaded * 100)}%`);
        });
      },
    });
  });
}
```

### 3. Executing Translations

The API supports both static and streaming responses.

**Standard Translation:**

```javascript
const translator = await Translator.create({
  sourceLanguage: 'en',
  targetLanguage: 'fr',
});

const result = await translator.translate(
  'Where is the next bus stop, please?',
);
console.log(result);
// Output: "Où est le prochain arrêt de bus, s'il vous plaît ?"
```

**Streaming Translation (for long text):**

```javascript
const stream = translator.translateStreaming(longText);
for await (const chunk of stream) {
  console.log(chunk);
}
```

## Supported Languages

The API supports a wide range of BCP 47 language codes: Here are the languages supported by Chrome's implementation of the Translator API:

- **ar**: Arabic
- **bg**: Bulgarian
- **bn**: Bengali
- **cs**: Czech
- **da**: Danish
- **de**: German
- **el**: Greek
- **en**: English
- **es**: Spanish
- **fi**: Finnish
- **fr**: French
- **hi**: Hindi
- **hr**: Croatian
- **hu**: Hungarian
- **id**: Indonesian
- **it**: Italian
- **iw**: Hebrew
- **ja**: Japanese
- **kn**: Kannada
- **ko**: Korean
- **lt**: Lithuanian
- **mr**: Marathi
- **nl**: Dutch
- **no**: Norwegian
- **pl**: Polish
- **pt**: Portuguese
- **ro**: Romanian
- **ru**: Russian
- **sk**: Slovak
- **sl**: Slovenian
- **sv**: Swedish
- **ta**: Tamil
- **te**: Telugu
- **th**: Thai
- **tr**: Turkish
- **uk**: Ukrainian
- **vi**: Vietnamese
- **zh**: Chinese
- **zh-Hant**: Chinese (Traditional)

## Security & Performance

- **Permissions Policy:** Cross-origin iframes require explicit permission.
  ```html
  <iframe src="https://example.com/" allow="translator"></iframe>
  ```
- **Web Workers:** Currently **not supported** due to Permission Policy
  complexities.
- **Privacy:** No data is sent to Google servers during the translation process
  once the model is downloaded.

## Fallback Strategy

Translator has limited availability.
Supported by: Chrome 138 (Jun 2025).
Unsupported in: Edge, Firefox, and Safari.

Before use, check if the `Translator` object is available in the global scope:

```javascript
if ('Translator' in self) {
  // The Translator API is supported.
} else {
  // Execute fallback strategy
}
```

If the `Translator` API is unsupported or availability checks return `'unavailable'`, you must gracefully fall back. 

Recommended options:
1. **Remote API Fallback**: Redirect the translation request to a server endpoint or cloud remote API (such as the Vertex AI Gemini API) to deliver translation functionality.
2. **Graceful Degradation**: Visually disable translation control elements or buttons while showing an end-user friendly note (e.g., `"Client-side translation is currently unsupported in this browser"`). Do not allow unhandled exceptions.
3. **Polyfill Fallback**: You can use community-maintained polyfills like `built-in-ai-task-apis-polyfills` or `prompt-api-polyfill` to emulate the API surface using remote services.

> **Privacy and Cost Implications:** These polyfills proxy requests to remote servers (such as Gemini API over the cloud). This completely nullifies the on-device privacy guarantees of the native Built-in AI APIs and will incur server-side API usage costs.
