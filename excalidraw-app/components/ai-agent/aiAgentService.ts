import {
  getTextFromElements,
  getNonDeletedElements,
} from "@excalidraw/excalidraw";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import type { AIAgentSettings, ChatMessage } from "./types";

const SYSTEM_PROMPT = `You are an expert AI whiteboard assistant and diagram architect embedded inside Excalidraw.
Your mission is to help users design, visualize, and brainstorm diagrams directly on their Excalidraw canvas.

GUIDELINES:
1. When asked to draw, design, explain, or generate any diagram, concept, architecture, or workflow:
   - Provide a concise, helpful explanation of the design in natural conversational text.
   - ALWAYS output the diagram definition inside a \`\`\`mermaid code block.
2. Supported Mermaid diagram types:
   - Flowcharts / Workflows: \`flowchart TD\` or \`flowchart LR\`
   - API / Protocol / Sequence interactions: \`sequenceDiagram\`
   - Mindmaps / Brainstorming / Hierarchies: \`mindmap\`
   - Entity Relationship diagrams: \`erDiagram\`
   - Class / Object structures: \`classDiagram\`
   - State machines / Lifecycles: \`stateDiagram-v2\`
   - Git workflows: \`gitGraph\`
3. Syntax rules for clean Excalidraw conversion:
   - In flowcharts, wrap node labels with special characters in double quotes: e.g. \`nodeA["Server (Node.js)"] --> nodeB["Database (PostgreSQL)"]\`
   - Keep node labels clear, human-readable, and well-structured.
   - Group related components with subgraphs where appropriate.
4. If the user asks for changes, additions, or refinements to an existing diagram:
   - Explain the changes made.
   - Provide the complete, updated \`\`\`mermaid code block so it renders on their whiteboard.
`;

export const extractDiagramFromText = (
  text: string,
): { diagramCode: string | null; diagramType: "mermaid" | null } => {
  const mermaidRegex = /```(?:mermaid)\s*([\s\S]*?)```/i;
  const match = text.match(mermaidRegex);

  if (match && match[1]?.trim()) {
    return {
      diagramCode: match[1].trim(),
      diagramType: "mermaid",
    };
  }

  // Fallback: generic code block that looks like mermaid
  const genericBlockRegex = /```\s*([\s\S]*?)```/i;
  const genericMatch = text.match(genericBlockRegex);
  if (genericMatch && genericMatch[1]?.trim()) {
    const candidate = genericMatch[1].trim();
    if (
      /^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|stateDiagram-v2|erDiagram|mindmap|gitGraph|journey|gantt|pie|timeline)\b/m.test(
        candidate,
      )
    ) {
      return {
        diagramCode: candidate,
        diagramType: "mermaid",
      };
    }
  }

  return { diagramCode: null, diagramType: null };
};

export const getCanvasSummaryContext = (
  api: ExcalidrawImperativeAPI,
): string | null => {
  try {
    const elements = getNonDeletedElements(api.getSceneElements());
    if (elements.length === 0) {
      return null;
    }

    const texts = getTextFromElements(elements);
    const elementTypesCount: Record<string, number> = {};
    elements.forEach((el) => {
      elementTypesCount[el.type] = (elementTypesCount[el.type] || 0) + 1;
    });

    const summaryParts = [
      `Total elements on canvas: ${elements.length}`,
      `Breakdown: ${Object.entries(elementTypesCount)
        .map(([k, v]) => `${v} ${k}(s)`)
        .join(", ")}`,
    ];

    if (texts && texts.trim()) {
      summaryParts.push(`Text found on the canvas:\n${texts.slice(0, 1000)}`);
    }

    return summaryParts.join("\n");
  } catch (err) {
    console.warn("Failed to extract canvas context summary", err);
    return null;
  }
};

export interface GenerateStreamOptions {
  settings: AIAgentSettings;
  history: ChatMessage[];
  userPrompt: string;
  canvasContext?: string | null;
  signal?: AbortSignal;
  ownerWindow?: Window | null;
  onChunk: (partialText: string) => void;
}

const parseSSELine = (line: string): { done: boolean; delta: string } => {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith("data:")) {
    return { done: false, delta: "" };
  }
  const dataPayload = trimmed.slice(5).trim();
  if (dataPayload === "[DONE]") {
    return { done: true, delta: "" };
  }
  try {
    const parsed = JSON.parse(dataPayload);
    const delta = parsed.choices?.[0]?.delta?.content || "";
    return { done: false, delta };
  } catch {
    return { done: false, delta: "" };
  }
};

export const streamAIChat = async ({
  settings,
  history,
  userPrompt,
  canvasContext,
  signal,
  ownerWindow,
  onChunk,
}: GenerateStreamOptions): Promise<{
  fullText: string;
  diagramCode: string | null;
  diagramType: "mermaid" | null;
}> => {
  const cleanBaseURL = settings.baseURL.replace(/\/+$/, "");
  const url = `${cleanBaseURL}/chat/completions`;
  const fetchFn = ownerWindow?.fetch?.bind(ownerWindow) ?? fetch;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (settings.apiKey && settings.apiKey.trim()) {
    headers.Authorization = `Bearer ${settings.apiKey.trim()}`;
  }

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  if (canvasContext) {
    messages.push({
      role: "system",
      content: `[Current Canvas Context]:\n${canvasContext}`,
    });
  }

  // Include up to last 8 valid completed conversation turns for context
  const validHistory = history
    .filter(
      (msg) =>
        (msg.role === "user" ||
          (msg.role === "assistant" && msg.status === "done")) &&
        msg.content.trim().length > 0,
    )
    .slice(-8);

  validHistory.forEach((msg) => {
    messages.push({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    });
  });

  messages.push({ role: "user", content: userPrompt });

  const response = await fetchFn(url, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model: settings.model.trim(),
      messages,
      stream: true,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    let errorDetail = "";
    try {
      const errJson = await response.json();
      errorDetail =
        errJson.error?.message || errJson.message || response.statusText;
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(
      `API error (${response.status}): ${errorDetail || response.statusText}`,
    );
  }

  const contentType = response.headers.get("content-type") || "";

  // Handle non-streaming JSON fallback for proxies that ignore stream: true
  if (contentType.includes("application/json")) {
    const json = await response.json();
    const fullText = json.choices?.[0]?.message?.content || "";
    if (fullText) {
      onChunk(fullText);
    }
    const { diagramCode, diagramType } = extractDiagramFromText(fullText);
    return { fullText, diagramCode, diagramType };
  }

  if (!response.body) {
    throw new Error("No response body received from model endpoint");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullText = "";
  let buffer = "";
  let streamFinished = false;

  while (!streamFinished) {
    if (signal?.aborted) {
      reader.cancel();
      break;
    }

    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      if (buffer.trim()) {
        const { delta } = parseSSELine(buffer);
        if (delta) {
          fullText += delta;
          onChunk(fullText);
        }
      }
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const { done: isDone, delta } = parseSSELine(line);
      if (isDone) {
        streamFinished = true;
        break;
      }
      if (delta) {
        fullText += delta;
        onChunk(fullText);
      }
    }
  }

  const { diagramCode, diagramType } = extractDiagramFromText(fullText);

  return {
    fullText,
    diagramCode,
    diagramType,
  };
};
