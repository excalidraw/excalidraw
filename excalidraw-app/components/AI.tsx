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
