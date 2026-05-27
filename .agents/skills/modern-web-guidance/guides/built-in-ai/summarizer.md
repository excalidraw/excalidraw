The **Summarizer API** allows web developers to offer local, AI-powered text distillation directly within the browser using **Gemini Nano in Chrome or Phi in Edge**. This API supports various formats, including key points, headlines, and TL;DRs, while operating entirely on-device to ensure user privacy.

---

## Getting Started

The Summarizer API is available starting in **Chrome and Edge 138**. It requires a one-time model download of Gemini Nano or Phi (respectively).


### Hardware & Software Requirements

- **OS**: Windows 10/11, macOS 13+, Linux, or ChromeOS (Chromebook Plus).
- **Storage**: 22GB free space for the profile volume.
- **RAM/CPU**: 16GB+ RAM and 4+ CPU cores.
- **VRAM**: 4GB+ (if using GPU).

### Model Download and Availability

Check if the model is ready, needs downloading, or is unavailable. 

**Mandatory Options Passing:** You must pass the identical configuration options object to both `Summarizer.availability(options)` and `Summarizer.create(options)`. Do NOT use the deprecated `window.ai.summarizer` API surface.

**Mandatory Progress Monitoring:** You MUST implement a monitor for model download progress by providing a `monitor(m)` callback to `Summarizer.create()` and adding a listener for the `downloadprogress` event.

**User Gesture Requirement:** When `availability` is `'downloadable'` or `'downloading'`, triggering the actual download via `Summarizer.create()` requires a user gesture (such as a user click). You must place the creation call inside an event listener rather than calling it unconditionally on page load to prevent `NotAllowedError`.

```javascript
const options = {
  type: 'key-points',
  format: 'plain-text',
  length: 'medium'
};

const availability = await Summarizer.availability(options);

if (availability === 'available') {
  const summarizer = await Summarizer.create(options);
  // Ready to use immediately
} else if (availability === 'downloadable') {
  // A user gesture is strictly required to start the download
  document.getElementById('start-download-btn').addEventListener('click', async () => {
    const summarizer = await Summarizer.create({
      ...options,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          console.log(`Downloaded ${Math.round((e.loaded / e.total) * 100)}%`);
        });
      },
    });
  });
}
```

## API Functions & Configuration

When creating a summarizer via `Summarizer.create(options)`, you can customize
the output:

| Parameter    | Options                                    | Description                             |
| :----------- | :----------------------------------------- | :-------------------------------------- |
| `type`       | `key-points`, `tldr`, `teaser`, `headline` | Defines the summary strategy.           |
| `format`     | `markdown`, `plain-text`                   | Output syntax style.                    |
| `length`     | `short`, `medium`, `long`                  | Target length (e.g., 1 vs 5 sentences). |
| `preference` | `auto`, `speed`, `capability`              | Balances latency vs. quality.           |

### Example Configuration

```javascript
const options = {
  sharedContext: 'This is a scientific article',
  type: 'key-points',
  format: 'markdown',
  length: 'medium',
};

if (navigator.userActivation.isActive) {
  const summarizer = await Summarizer.create(options);
}
```

### Language Support

You can specify expected languages to ensure the browser can handle the specific
summary request.

```javascript
const summarizer = await Summarizer.create({
  type: 'key-points',
  expectedInputLanguages: ['en', 'ja'],
  outputLanguage: 'es',
});
```

## Summarization Methods

### 1. Batch Summarization

Processes the entire text at once and returns the result.

```javascript
const longText = document.querySelector('article').innerText;
const summary = await summarizer.summarize(longText, {
  context: 'This article is intended for a tech-savvy audience.',
});
console.log(summary);
```

### 2. Stream Summarization

Returns results in real-time as the model generates them, providing a more
responsive UI.

```javascript
const stream = summarizer.summarizeStreaming(longText);
for await (const chunk of stream) {
  console.log(chunk);
}
```

## Security and Permissions

- **Data Privacy**: No data is sent to Google; processing happens on the local
  device.
- **Cross-Origin**: Access can be granted to iframes using the Permission
  Policy.
  ```html
  <iframe src="https://example.com/" allow="summarizer"></iframe>
  ```
- **Web Workers**: Currently not supported.

## Fallback Strategy

Summarizer has limited availability.
Supported by: Chrome 138 (Jun 2025).
Unsupported in: Edge, Firefox, and Safari.

Before initializing or querying availability, check if the browser supports the `Summarizer` API:

```javascript
if ('Summarizer' in self) {
  // The Summarizer API is supported.
} else {
  // Execute fallback strategy
}
```

If the `Summarizer` API is unsupported or availability checks return `'unavailable'`, you must gracefully fall back.

Recommended options:
1. **Remote API Fallback**: Direct the distillation request to a server endpoint or remote API (such as the Vertex AI Gemini API) so that users still get summaries.
2. **Graceful Degradation**: Visually disable the summarization controls in the UI, or hide the button while displaying a friendly message (e.g., `"Local summarization is currently unsupported in this browser"`). Do not allow interaction to trigger generic unhandled runtime exceptions.
3. **Polyfill Fallback**: You can use community-maintained polyfills like `built-in-ai-task-apis-polyfills` or `prompt-api-polyfill` to emulate the API surface using remote services with models in the cloud or on-device inference with local models.

> **Privacy and Cost Implications:** These polyfills possibly proxy requests to remote servers (such as Gemini API over the cloud). This completely nullifies the on-device privacy guarantees of the native Built-in AI APIs and will incur server-side API usage costs.
