
import { EditorLocalStorage } from "../EditorLocalStorage";
import { EDITOR_LS_KEYS, MIME_TYPES } from "@excalidraw/common";

export interface OpenRouterResponse {
    choices: {
        message: {
            content: string;
        };
    }[];
}

export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4.5";
export const DEFAULT_OPENROUTER_API_KEY = "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";

export class OpenRouterClient {
    static getApiKey(): string | null {
        return EditorLocalStorage.get(EDITOR_LS_KEYS.OPENROUTER_API_KEY) || DEFAULT_OPENROUTER_API_KEY;
    }

    static setApiKey(key: string) {
        EditorLocalStorage.set(EDITOR_LS_KEYS.OPENROUTER_API_KEY, key);
    }

    static getModel(): string {
        return EditorLocalStorage.get(EDITOR_LS_KEYS.OPENROUTER_MODEL) || DEFAULT_OPENROUTER_MODEL;
    }

    static setModel(model: string) {
        EditorLocalStorage.set(EDITOR_LS_KEYS.OPENROUTER_MODEL, model);
    }

    static async generateCompletion(
        messages: { role: "system" | "user"; content: string | any[] }[],
        model?: string,
    ): Promise<string> {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error("OpenRouter API key not found");
        }

        const selectedModel = model || this.getModel();

        // Use a valid referer - Capacitor on Android may have a non-standard origin
        const referer = window.location.origin.startsWith('http')
            ? window.location.origin
            : 'https://excalidraw.com';

        const response = await fetch(OPENROUTER_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                "HTTP-Referer": referer, // Required by OpenRouter
                "X-Title": "Excalidraw", // Optional
            },
            body: JSON.stringify({
                model: selectedModel,
                messages,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                errorData.error?.message || `OpenRouter API Error: ${response.statusText}`,
            );
        }

        const data: OpenRouterResponse = await response.json();
        return data.choices[0]?.message?.content || "";
    }

    static async generateDiagram(prompt: string): Promise<string> {
        // System prompt will be refined in the refactoring step
        // For now, providing a basic placeholder
        return this.generateCompletion([
            {
                role: "user",
                content: prompt
            }
        ]);
    }
}
