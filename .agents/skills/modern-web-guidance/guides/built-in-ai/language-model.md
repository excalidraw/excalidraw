The Prompt API allows developers to run natural language processing tasks directly in the browser using **Gemini Nano**. This built-in AI approach ensures user privacy, reduces server costs, and enables offline functionality.

## 1. Getting Started and Hardware Requirements

The Prompt API is currently available in Chrome as of version 148 (Desktop) for Windows, macOS, Linux, and Chromebook Plus.

### Hardware Prerequisites

- **Storage**: 22 GB free space (for the initial profile and model).
- **Memory/CPU**: 16 GB RAM and 4+ CPU cores.
- **GPU**: 4 GB VRAM or more (Required for audio input).
- **Network**: Required only for the initial model download.

### Initializing the API

Check model availability before triggering a download:

```javascript
const availability = await LanguageModel.availability();

// Do not call create() when unavailable — the model cannot run on this device.
if (availability !== 'unavailable') {
	const session = await LanguageModel.create({
		monitor(m) {
			// Inform the user while the model downloads so the UI doesn't appear frozen.
			m.addEventListener('downloadprogress', (e) => {
				console.log(`Downloaded ${e.loaded * 100}%`);
			});
		},
	});
}
```

## 2. Core Prompting Capabilities

Session examples in this section omit `session.destroy()` for brevity. Always call `session.destroy()` when a session is no longer needed to free device memory (see Section 5).

### Basic and Streamed Output

For short responses, use `prompt()`. For longer content, use `promptStreaming()` to provide a more responsive UI.

**MANDATORY**: Never assign model output to `innerHTML`. Model output is untrusted and can contain injected markup. Always use `textContent` or a sanitizer.

```javascript
const session = await LanguageModel.create();

// prompt() accumulates the full response before resolving — use for short, one-shot output.
const result = await session.prompt('Write a haiku about coding.');
// textContent, not innerHTML — model output is untrusted and must not be parsed as markup.
outputEl.textContent = result;

// promptStreaming() yields independent chunks that must be concatenated;
// use for longer content so each chunk can be rendered progressively.
const stream = session.promptStreaming('Write a long story about a robot.');
let completeResult = '';
for await (const chunk of stream) {
	completeResult += chunk;
	outputEl.append(chunk);
}
console.log('Full story:', completeResult);
```

### Multimodal Input

The Prompt API supports text, audio, and visual inputs (images, canvas, video frames).

```javascript
const session = await LanguageModel.create({
	// Declaring expected input types lets the browser optimize model loading.
	expectedInputs: [{ type: 'text' }, { type: 'image' }],
	expectedOutputs: [{ type: 'text' }],
});

const response = await session.prompt([
	{
		role: 'user',
		content: [
			{ type: 'text', value: 'What is in this image?' },
			{ type: 'image', value: document.querySelector('canvas') },
		],
	},
]);
```

## 3. Advanced Session Management

Sessions allow the model to maintain context across multiple interactions.

### Context and Quota

Each session has a maximum token limit. You can monitor usage via `session.contextUsage` and `session.contextWindow`. If the window overflows, the oldest messages (except the system prompt) are dropped.

### Cloning Sessions

Cloning is efficient for starting parallel conversations that share the same initial context (like a "system" personality) without re-initializing.

```javascript
const mainSession = await LanguageModel.create({
	initialPrompts: [{ role: 'system', content: 'You speak like a pirate.' }],
});

const branchA = await mainSession.clone();
const branchB = await mainSession.clone();
// Destroy the base after cloning — the clones own their own context from here.
mainSession.destroy();
```

### Restoring Past Sessions

While a native "restore" feature is in development, you can recreate a session by feeding previous history into `initialPrompts`.

**Note**: `localStorage` is unencrypted and persistent. Stored conversation history may include user PII — consider the privacy implications before persisting chat history.

```javascript
// || '[]' ensures JSON.parse never receives null when the key doesn't exist yet.
const history = JSON.parse(localStorage.getItem('chat_history') || '[]');
const session = await LanguageModel.create({
	initialPrompts: history, // Array of {role, content} objects
});
```

## 4. Structured Output with JSON Schema

To prevent the model from adding "chatter" (e.g., "Sure, here is your JSON:"), use a **JSON Schema** via the `responseConstraint` field. This ensures the output is valid JSON that can be parsed immediately.

### Example: Sentiment Classification

```javascript
// Pass the schema as a plain object — do not JSON.stringify() it first.
const schema = {
	type: 'object',
	properties: {
		rating: { type: 'number', minimum: 1, maximum: 5 },
		is_positive: { type: 'boolean' },
	},
	required: ['rating', 'is_positive'],
};

const result = await session.prompt(
	"Rate the following feedback: 'The food was great!'",
	{ responseConstraint: schema },
);

const data = JSON.parse(result);
console.log(data.rating); // 5
```

### Constraints and Prefixes

You can guide the model further by prefilling the assistant's response using `prefix: true`.

````javascript
const character = await session.prompt([
	{ role: 'user', content: 'Create a character sheet' },
	{ role: 'assistant', content: '```json\n', prefix: true },
]);
````

## 5. Best Practices and Safety

- **Resource Cleanup**: Always call `session.destroy()` when a conversation is finished to free up memory.
- **Output Safety**: Model output is untrusted. Always write results to `textContent`, not `innerHTML`, to prevent XSS injection from malicious model output.
- Use a sanitizer like the native Sanitizer API or DOMPurify if you need to allow limited HTML.
- **Aborting Tasks**: Use `AbortController` to allow users to stop long-running generations. Pass the `signal` to `prompt()` or `promptStreaming()`, not to `LanguageModel.create()`.
- **Security**: Use Permission Policies to control access in iframes: `<iframe src="..." allow="language-model"></iframe>`.
- **Design**: Review the [People + AI Guidebook](https://pair.withgoogle.com/guidebook/) to ensure responsible AI implementation.

By combining structured outputs with robust session management, developers can build complex, stateful AI applications that run entirely on the user's device.

## 6. Fallback strategies

LanguageModel has limited availability.
Supported by: Chrome 148 (May 2026) and Edge 148 (May 2026).
Unsupported in: Firefox and Safari.

Before use, check if the LanguageModel object is available in the global scope:

```js
if ('LanguageModel' in self) {
  // The Prompt API is supported.
} else {
  // Execute fallback strategy
}
```

If the Prompt API is unsupported or availability checks return 'unavailable', you must gracefully fall back:

* Remote API Fallback: Redirect the detection request to a server endpoint or a cloud API (such as the Vertex AI Gemini API).
* Local API Fallback: Redirect the detection request to a local endpoint, for example, using Transformers.js. 
