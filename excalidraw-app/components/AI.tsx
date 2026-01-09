import {
  DiagramToCodePlugin,
  exportToBlob,
  getTextFromElements,
  MIME_TYPES,
  TTDDialog,
} from "@excalidraw/excalidraw";
import { getDataURL } from "@excalidraw/excalidraw/data/blob";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS, type AIProvider } from "./AISettingsDialog";

const MERMAID_SYSTEM_PROMPT = `You are a Mermaid diagram expert. Generate ONLY valid Mermaid syntax.
No explanations, no markdown code blocks, just raw Mermaid code.
Start directly with the diagram type (flowchart, sequenceDiagram, classDiagram, etc).`;

const PROMPT_MODE_SYSTEM = `You are a technical prompt engineer. Analyze this wireframe and create a comprehensive development prompt in Markdown.

Output format:

# [App Name] - Development Prompt

## Overview
Brief description of the application based on the wireframe.

## Target Users
Who will use this application.

## Core Features
List each feature/screen visible in the wireframe:
- Feature 1: description
- Feature 2: description

## Tech Stack Recommendation
- Frontend: [framework]
- Backend: [if needed]
- Database: [if needed]
- Auth: [if needed]

## Implementation Guide

### 1. Project Setup
\`\`\`bash
# Commands to initialize project
\`\`\`

### 2. File Structure
\`\`\`
src/
├── components/
├── pages/
└── ...
\`\`\`

### 3. Key Components
For each component visible in wireframe:
- Component name
- Props/state needed
- Behavior description

### 4. Data Models
\`\`\`typescript
interface User { ... }
interface ... { ... }
\`\`\`

### 5. API Endpoints (if backend needed)
- GET /api/...
- POST /api/...

## MVP Scope
Priority features for first version.

## Notes
Any additional context from the wireframe.`;

const IMAGE_DESCRIBE_SYSTEM = `You are an image analysis expert. Provide a comprehensive description of this image in Markdown format.

## Visual Description
Describe what you see: main subjects, objects, people, setting, and composition.

## Colors & Style
- Dominant colors and color palette
- Lighting conditions
- Artistic or photographic style

## Context & Mood
- The atmosphere or emotion conveyed
- Potential context or story
- Target audience or use case

## Technical Details
- Image quality and resolution impression
- Composition techniques used
- Notable visual elements

## Suggested Tags
List 5-10 keywords that describe this image, comma-separated.`;

const getAIConfig = () => {
  const provider =
    (localStorage.getItem(STORAGE_KEYS.PROVIDER) as AIProvider) || "ollama";
  const model = localStorage.getItem(STORAGE_KEYS.MODEL) || "";
  const ollamaUrl =
    localStorage.getItem(STORAGE_KEYS.OLLAMA_URL) || "http://localhost:11434";

  let apiKey = "";
  if (provider === "openai") {
    apiKey = localStorage.getItem(STORAGE_KEYS.OPENAI_KEY) || "";
  } else if (provider === "anthropic") {
    apiKey = localStorage.getItem(STORAGE_KEYS.ANTHROPIC_KEY) || "";
  }

  return { provider, model, apiKey, ollamaUrl };
};

const callOpenAI = async (
  prompt: string,
  systemPrompt: string,
  model: string,
  apiKey: string,
): Promise<string> => {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "OpenAI request failed");
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

const callAnthropic = async (
  prompt: string,
  systemPrompt: string,
  model: string,
  apiKey: string,
): Promise<string> => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: model || "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Anthropic request failed");
  }

  const data = await response.json();
  return data.content[0].text;
};

const callOllama = async (
  prompt: string,
  systemPrompt: string,
  model: string,
  ollamaUrl: string,
): Promise<string> => {
  const response = await fetch(`${ollamaUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || "llama3.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error("Ollama request failed");
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

const generateWithAI = async (
  prompt: string,
  systemPrompt: string,
): Promise<string> => {
  const { provider, model, apiKey, ollamaUrl } = getAIConfig();

  let result: string;

  switch (provider) {
    case "openai":
      if (!apiKey) {
        throw new Error("OpenAI API key not configured. Open AI Settings.");
      }
      result = await callOpenAI(prompt, systemPrompt, model, apiKey);
      break;
    case "anthropic":
      if (!apiKey) {
        throw new Error("Anthropic API key not configured. Open AI Settings.");
      }
      result = await callAnthropic(prompt, systemPrompt, model, apiKey);
      break;
    case "ollama":
    default:
      result = await callOllama(prompt, systemPrompt, model, ollamaUrl);
      break;
  }

  result = result.trim();
  if (result.startsWith("```")) {
    const lines = result.split("\n");
    result = lines
      .slice(1, lines[lines.length - 1] === "```" ? -1 : undefined)
      .join("\n");
  }

  return result;
};

export type GenerationMode = "html" | "prompt";

export const wrapMarkdownInHtml = (
  markdown: string,
  theme: string,
  title: string = "Development Prompt",
): string => {
  const isDark = theme === "dark";
  const escaped = JSON.stringify(markdown);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      padding: 16px;
      background: ${isDark ? "#1e1e1e" : "#fff"};
      color: ${isDark ? "#e0e0e0" : "#1e1e1e"};
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid ${isDark ? "#404040" : "#e0e0e0"};
    }
    .header h3 { font-size: 14px; font-weight: 600; }
    .copy-btn {
      padding: 6px 12px;
      border: 1px solid ${isDark ? "#404040" : "#e0e0e0"};
      border-radius: 6px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-size: 12px;
    }
    .copy-btn:hover { background: ${isDark ? "#333" : "#f0f0f0"}; }
    .content {
      font-family: ui-monospace, 'SF Mono', Monaco, monospace;
      font-size: 12px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow-y: auto;
      max-height: calc(100vh - 80px);
    }
  </style>
</head>
<body>
  <div class="header">
    <h3>${title}</h3>
    <button class="copy-btn" onclick="copyMarkdown()">Copy</button>
  </div>
  <pre class="content" id="content"></pre>
  <script>
    const markdown = ${escaped};
    document.getElementById('content').textContent = markdown;
    function copyMarkdown() {
      navigator.clipboard.writeText(markdown).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
      });
    }
  </script>
</body>
</html>`;
};

export const generatePromptFromWireframe = async (
  dataURL: string,
  textElements: string,
): Promise<string> => {
  const { provider, model, apiKey, ollamaUrl } = getAIConfig();

  const systemPrompt = `${PROMPT_MODE_SYSTEM}

The wireframe contains these text elements: ${textElements}`;

  let result: string;

  if (provider === "openai" && apiKey) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this wireframe and generate a development prompt",
              },
              { type: "image_url", image_url: { url: dataURL } },
            ],
          },
        ],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      throw new Error("OpenAI vision request failed");
    }

    const data = await response.json();
    result = data.choices[0].message.content;
  } else if (provider === "anthropic" && apiKey) {
    const base64Data = dataURL.split(",")[1];
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: "Analyze this wireframe and generate a development prompt",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error("Anthropic vision request failed");
    }

    const data = await response.json();
    result = data.content[0].text;
  } else {
    const response = await fetch(`${ollamaUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "llava",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this wireframe and generate a development prompt",
              },
              { type: "image_url", image_url: { url: dataURL } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error("Ollama vision request failed");
    }

    const data = await response.json();
    result = data.choices[0].message.content;
  }

  return result.trim();
};

export const generateImageDescription = async (
  dataURL: string,
): Promise<string> => {
  const { provider, model, apiKey, ollamaUrl } = getAIConfig();

  const systemPrompt = IMAGE_DESCRIBE_SYSTEM;

  let result: string;

  if (provider === "openai" && apiKey) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Describe this image in detail",
              },
              { type: "image_url", image_url: { url: dataURL } },
            ],
          },
        ],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      throw new Error("OpenAI vision request failed");
    }

    const data = await response.json();
    result = data.choices[0].message.content;
  } else if (provider === "anthropic" && apiKey) {
    const base64Data = dataURL.split(",")[1];
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: "Describe this image in detail",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error("Anthropic vision request failed");
    }

    const data = await response.json();
    result = data.content[0].text;
  } else {
    const response = await fetch(`${ollamaUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "llava",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Describe this image in detail",
              },
              { type: "image_url", image_url: { url: dataURL } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error("Ollama vision request failed");
    }

    const data = await response.json();
    result = data.choices[0].message.content;
  }

  return result.trim();
};

export const AIComponents = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
}) => {
  return (
    <>
      <DiagramToCodePlugin
        generate={async ({ frame, children }) => {
          const appState = excalidrawAPI.getAppState();

          const blob = await exportToBlob({
            elements: children,
            appState: {
              ...appState,
              exportBackground: true,
              viewBackgroundColor: appState.viewBackgroundColor,
            },
            exportingFrame: frame,
            files: excalidrawAPI.getFiles(),
            mimeType: MIME_TYPES.jpg,
          });

          const dataURL = await getDataURL(blob);
          const textFromFrameChildren = getTextFromElements(children);

          const systemPrompt = `You are a frontend developer. Convert the wireframe/mockup into clean HTML/CSS.
Theme: ${appState.theme}
Generate a complete, self-contained HTML document with inline CSS.
Make it responsive and modern-looking.
The wireframe contains these text elements: ${textFromFrameChildren}`;

          try {
            const { provider, model, apiKey, ollamaUrl } = getAIConfig();

            let html: string;

            if (provider === "openai" && apiKey) {
              const response = await fetch(
                "https://api.openai.com/v1/chat/completions",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                  },
                  body: JSON.stringify({
                    model: model || "gpt-4o",
                    messages: [
                      { role: "system", content: systemPrompt },
                      {
                        role: "user",
                        content: [
                          {
                            type: "text",
                            text: "Convert this wireframe to HTML/CSS",
                          },
                          { type: "image_url", image_url: { url: dataURL } },
                        ],
                      },
                    ],
                    max_tokens: 4096,
                  }),
                },
              );

              if (!response.ok) {
                throw new Error("OpenAI vision request failed");
              }

              const data = await response.json();
              html = data.choices[0].message.content;
            } else if (provider === "anthropic" && apiKey) {
              const base64Data = dataURL.split(",")[1];
              const response = await fetch(
                "https://api.anthropic.com/v1/messages",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "anthropic-version": "2023-06-01",
                    "anthropic-dangerous-direct-browser-access": "true",
                  },
                  body: JSON.stringify({
                    model: model || "claude-sonnet-4-20250514",
                    max_tokens: 4096,
                    system: systemPrompt,
                    messages: [
                      {
                        role: "user",
                        content: [
                          {
                            type: "image",
                            source: {
                              type: "base64",
                              media_type: "image/jpeg",
                              data: base64Data,
                            },
                          },
                          {
                            type: "text",
                            text: "Convert this wireframe to HTML/CSS",
                          },
                        ],
                      },
                    ],
                  }),
                },
              );

              if (!response.ok) {
                throw new Error("Anthropic vision request failed");
              }

              const data = await response.json();
              html = data.content[0].text;
            } else {
              const response = await fetch(`${ollamaUrl}/v1/chat/completions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: model || "llava",
                  messages: [
                    { role: "system", content: systemPrompt },
                    {
                      role: "user",
                      content: [
                        {
                          type: "text",
                          text: "Convert this wireframe to HTML/CSS",
                        },
                        { type: "image_url", image_url: { url: dataURL } },
                      ],
                    },
                  ],
                }),
              });

              if (!response.ok) {
                throw new Error("Ollama vision request failed");
              }

              const data = await response.json();
              html = data.choices[0].message.content;
            }

            if (html.includes("```html")) {
              const start = html.indexOf("```html") + 7;
              const end = html.indexOf("```", start);
              html = html.slice(start, end).trim();
            } else if (html.includes("```")) {
              const start = html.indexOf("```") + 3;
              const end = html.indexOf("```", start);
              html = html.slice(start, end).trim();
            }

            return { html };
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : "Generation failed";
            return {
              html: `<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif"><div style="text-align:center;color:red">${message}</div></body></html>`,
            };
          }
        }}
      />

      <TTDDialog
        onTextSubmit={async (input) => {
          try {
            const generatedResponse = await generateWithAI(
              input,
              MERMAID_SYSTEM_PROMPT,
            );

            return {
              generatedResponse,
              rateLimit: 100,
              rateLimitRemaining: 99,
            };
          } catch (err: unknown) {
            const message =
              err instanceof Error ? err.message : "Request failed";
            throw new Error(message);
          }
        }}
      />
    </>
  );
};
