# Requirements Verification Questions

Please answer the following questions to help clarify the requirements for the image-to-diagram conversion feature.

## Question 1
What image input methods should be supported?

A) Paste from clipboard only
B) File upload dialog only  
C) Drag and drop only
D) All of the above (paste, upload, drag & drop)
E) Other (please describe after [Answer]: tag below)

[Answer]: D) All of the above (paste, upload, drag & drop)



## Question 2
What types of diagrams should the LLM vision model be optimized to recognize?

A) Flowcharts only (since mermaid-to-excalidraw supports flowcharts)
B) Flowcharts + basic shapes (rectangles, circles, arrows)
C) Any diagram type that can be represented in Mermaid
D) Focus on Excalidraw-style hand-drawn diagrams specifically
E) Other (please describe after [Answer]: tag below)

[Answer]: C) Any diagram type that can be represented in Mermaid


## Question 3
How should the LLM vision model be integrated?

A) Direct API calls to OpenAI GPT-4 Vision or similar service
B) Local model integration (like Ollama with vision capabilities)
C) Configurable - allow users to choose their preferred LLM service
D) Start with one service, make it configurable later
E) Other (please describe after [Answer]: tag below)

[Answer]: C) Configurable - allow users to choose their preferred LLM service


## Question 4
What should happen when the LLM fails to generate valid Mermaid code after multiple attempts?

A) Show error message and let user manually edit the generated code
B) Fall back to basic shape recognition without Mermaid conversion
C) Allow user to provide hints/corrections and retry
D) Show the best attempt and let user choose to accept or retry
E) Other (please describe after [Answer]: tag below)

[Answer]: D) Show the best attempt and let user choose to accept or retry


## Question 5
Where should this feature be accessible in the Excalidraw UI?

A) New button in the main toolbar
B) Option in the existing import menu/dialog
C) Right-click context menu option
D) Keyboard shortcut (Ctrl+Shift+V for paste image)
E) Other (please describe after [Answer]: tag below)

[Answer]: A) New button in the main toolbar


## Question 6
Should there be a preview/editing step before converting to Excalidraw elements?

A) Yes - show the generated Mermaid code and allow editing before conversion
B) Yes - show a preview of the converted elements with option to retry
C) No - convert directly and let users undo if needed
D) Make it configurable - users can choose preview mode or direct conversion
E) Other (please describe after [Answer]: tag below)

[Answer]: D) Make it configurable - users can choose preview mode or direct conversion

## Question 7
What image formats should be supported?

A) PNG only (most common for screenshots)
B) PNG and JPEG
C) PNG, JPEG, and SVG
D) All common web image formats (PNG, JPEG, SVG, WebP, GIF)
E) Other (please describe after [Answer]: tag below)

[Answer]: D) All common web image formats (PNG, JPEG, SVG, WebP, GIF)


## Question 8
Should this feature work offline or require internet connection?

A) Internet required (for cloud LLM services)
B) Offline capable (with local models)
C) Hybrid - prefer offline but fallback to online
D) Let users configure their preference
E) Other (please describe after [Answer]: tag below)

[Answer]: D) Let users configure their preference
