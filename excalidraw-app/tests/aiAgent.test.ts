import { vi } from "vitest";

import { toBrandedType } from "@excalidraw/common";
import { getClientColor } from "@excalidraw/excalidraw/clients";

import type {
  ExcalidrawImperativeAPI,
  SocketId,
} from "@excalidraw/excalidraw/types";

import { AgentCursorController } from "../components/ai-agent/agentCursorController";
import {
  extractDiagramFromText,
  streamAIChat,
} from "../components/ai-agent/aiAgentService";
import {
  DEFAULT_AI_SETTINGS,
  loadAISettings,
  saveAISettings,
} from "../components/ai-agent/aiAgentSettings";
import { parseMermaidCode } from "../components/ai-agent/diagramGenerator";

describe("AI Agent Mode", () => {
  describe("extractDiagramFromText", () => {
    it("extracts mermaid block from text", () => {
      const text = `
Here is the user authentication flow you asked for:

\`\`\`mermaid
flowchart TD
  A[User] --> B[Login Page]
  B --> C[Verify Credentials]
\`\`\`

Let me know if you need any adjustments!
`;
      const result = extractDiagramFromText(text);
      expect(result.diagramType).toBe("mermaid");
      expect(result.diagramCode).toBe(
        "flowchart TD\n  A[User] --> B[Login Page]\n  B --> C[Verify Credentials]",
      );
    });

    it("extracts untagged code block if it contains mermaid keywords", () => {
      const text = `
\`\`\`
sequenceDiagram
  Client->>Server: Request
  Server-->>Client: Response
\`\`\`
`;
      const result = extractDiagramFromText(text);
      expect(result.diagramType).toBe("mermaid");
      expect(result.diagramCode).toContain("sequenceDiagram");
    });

    it("returns null if no diagram is present", () => {
      const text = "Hello! I can help you draw diagrams on Excalidraw.";
      const result = extractDiagramFromText(text);
      expect(result.diagramCode).toBeNull();
      expect(result.diagramType).toBeNull();
    });
  });

  describe("Settings persistence", () => {
    it("returns defaults when localStorage is empty", () => {
      const mockStorage: Record<string, string> = {};
      const mockWin = {
        localStorage: {
          getItem: (key: string) => mockStorage[key] || null,
          setItem: (key: string, val: string) => {
            mockStorage[key] = val;
          },
        },
      } as unknown as Window;

      const loaded = loadAISettings(mockWin);
      expect(loaded.model).toBe(DEFAULT_AI_SETTINGS.model);
      expect(loaded.baseURL).toBe(DEFAULT_AI_SETTINGS.baseURL);
      expect(loaded.showCursor).toBe(true);
    });

    it("saves and loads custom settings correctly", () => {
      const mockStorage: Record<string, string> = {};
      const mockWin = {
        localStorage: {
          getItem: (key: string) => mockStorage[key] || null,
          setItem: (key: string, val: string) => {
            mockStorage[key] = val;
          },
        },
      } as unknown as Window;

      saveAISettings(
        {
          provider: "openrouter",
          apiKey: "test-key-123",
          baseURL: "https://openrouter.ai/api/v1",
          model: "anthropic/claude-3.5-sonnet",
          showCursor: false,
        },
        mockWin,
      );

      const loaded = loadAISettings(mockWin);
      expect(loaded.provider).toBe("openrouter");
      expect(loaded.apiKey).toBe("test-key-123");
      expect(loaded.model).toBe("anthropic/claude-3.5-sonnet");
      expect(loaded.showCursor).toBe(false);
    });
  });

  describe("parseMermaidCode", () => {
    it("converts mermaid flowchart into Excalidraw elements", async () => {
      const mermaid = `
flowchart TD
  A[Start] --> B[Process]
  B --> C[End]
`;
      const parsed = await parseMermaidCode(mermaid);
      expect(parsed.elements.length).toBeGreaterThan(0);
      const textElements = parsed.elements.filter((el) => el.type === "text");
      expect(textElements.length).toBeGreaterThan(0);
    });
  });

  describe("AgentCursorController", () => {
    it("resolves interrupted animateMoveTo promises cleanly without hanging", async () => {
      const collaborators = new Map();
      const mockAPI = {
        getAppState: () => ({
          scrollX: 0,
          scrollY: 0,
          width: 1000,
          height: 800,
          zoom: { value: 1 },
          collaborators,
        }),
        updateScene: vi.fn(),
      } as unknown as ExcalidrawImperativeAPI;

      let rafCounter = 0;
      const mockWin = {
        performance: { now: () => 0 },
        requestAnimationFrame: vi.fn(() => ++rafCounter),
        cancelAnimationFrame: vi.fn(),
        setTimeout: vi.fn(() => 1),
        clearTimeout: vi.fn(),
      } as unknown as Window;

      const controller = new AgentCursorController(mockAPI, () => mockWin);

      const firstMove = controller.animateMoveTo(100, 100, 500);
      // Superseding the in-flight animation should resolve the first promise
      const secondMove = controller.animateMoveTo(200, 200, 500);
      await expect(firstMove).resolves.toBeUndefined();

      // Destroying the controller should resolve the second promise
      controller.destroy();
      await expect(secondMove).resolves.toBeUndefined();
      expect(mockWin.cancelAnimationFrame).toHaveBeenCalled();
    });
  });

  describe("streamAIChat", () => {
    it("handles non-streaming application/json responses gracefully", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          choices: [
            {
              message: {
                content: "Here you go:\n```mermaid\nflowchart LR\nA-->B\n```",
              },
            },
          ],
        }),
      });

      const mockWin = { fetch: mockFetch } as unknown as Window;
      const chunks: string[] = [];

      const result = await streamAIChat({
        settings: { ...DEFAULT_AI_SETTINGS, apiKey: "test-key" },
        history: [],
        userPrompt: "Draw A to B",
        ownerWindow: mockWin,
        onChunk: (c) => chunks.push(c),
      });

      expect(result.diagramType).toBe("mermaid");
      expect(result.diagramCode).toBe("flowchart LR\nA-->B");
      expect(chunks.length).toBe(1);
    });

    it("flushes final SSE buffer line without trailing newline", async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"Hello "}}]}\n',
            ),
          );
          // Final line intentionally without trailing newline
          controller.enqueue(
            encoder.encode('data: {"choices":[{"delta":{"content":"world"}}]}'),
          );
          controller.close();
        },
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "text/event-stream" }),
        body: stream,
      });

      const mockWin = { fetch: mockFetch } as unknown as Window;
      const result = await streamAIChat({
        settings: { ...DEFAULT_AI_SETTINGS, apiKey: "test-key" },
        history: [],
        userPrompt: "Say hi",
        ownerWindow: mockWin,
        onChunk: () => {},
      });

      expect(result.fullText).toBe("Hello world");
    });
  });

  describe("getClientColor", () => {
    it("uses explicit collaborator.color.background when provided", () => {
      const socketId = toBrandedType<SocketId>("ai-agent-collaborator");
      const color = getClientColor(socketId, {
        id: "ai-agent-collaborator",
        color: { background: "#8b5cf6", stroke: "#6d28d9" },
      });
      expect(color).toBe("#8b5cf6");
    });
  });
});
