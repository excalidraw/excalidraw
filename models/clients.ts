import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { ModelConfig } from "./config";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenAIChatMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{
    type: "text" | "image_url";
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
}

export interface GeminiContent {
  role: "user" | "model";
  parts: Array<{
    text?: string;
    inlineData?: {
      mimeType: string;
      data: string;
    };
  }>;
}

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | Array<
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } }
  >;
}

// Convert OpenAI format messages to Anthropic format
export function convertToAnthropicFormat(messages: OpenAIChatMessage[]): AnthropicMessage[] {
  return messages
    .filter(msg => msg.role !== "system") // System messages are handled separately
    .map(msg => {
      const anthropicRole = msg.role === "assistant" ? "assistant" : "user";
      
      // Handle content conversion
      if (typeof msg.content === "string") {
        return {
          role: anthropicRole,
          content: msg.content
        };
      } else if (Array.isArray(msg.content)) {
        const anthropicContent: Array<
          | { type: "text"; text: string }
          | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } }
        > = [];
        
        for (const item of msg.content) {
          if (item.type === "text" && item.text) {
            anthropicContent.push({ type: "text", text: item.text });
          } else if (item.type === "image_url" && item.image_url) {
            // Extract base64 data from data URL
            const url = item.image_url.url;
            if (url.startsWith("data:")) {
              const [mimeTypePart, dataPart] = url.split(",");
              const mimeType = mimeTypePart.split(":")[1].split(";")[0];
              
              // Map mime types to Anthropic's supported types
              const supportedMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
              const anthropicMimeType = supportedMimeTypes.includes(mimeType) 
                ? mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp"
                : "image/jpeg"; // Default fallback
              
              anthropicContent.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: anthropicMimeType,
                  data: dataPart
                }
              });
            }
          }
        }
        
        return {
          role: anthropicRole,
          content: anthropicContent
        };
      }
      
      return {
        role: anthropicRole,
        content: ""
      };
    });
}

// Convert OpenAI format messages to Gemini format
export function convertToGeminiFormat(messages: OpenAIChatMessage[]): GeminiContent[] {
  return messages
    .filter(msg => msg.role !== "system") // System messages are handled separately
    .map(msg => {
      const geminiRole = msg.role === "assistant" ? "model" : "user";
      
      // Handle content conversion
      let parts: GeminiContent["parts"] = [];
      
      if (typeof msg.content === "string") {
        parts = [{ text: msg.content }];
      } else if (Array.isArray(msg.content)) {
        parts = msg.content.map(item => {
          if (item.type === "text") {
            return { text: item.text || "" };
          } else if (item.type === "image_url" && item.image_url) {
            // Extract base64 data from data URL
            const url = item.image_url.url;
            if (url.startsWith("data:")) {
              const [mimeTypePart, dataPart] = url.split(",");
              const mimeType = mimeTypePart.split(":")[1].split(";")[0];
              return {
                inlineData: {
                  mimeType,
                  data: dataPart
                }
              };
            }
          }
          return { text: "" }; // Fallback for unsupported content types
        });
      }
      
      return {
        role: geminiRole,
        parts
      };
    });
}

export interface LLMClient {
  generate(systemPrompt: string, messages: OpenAIChatMessage[]): Promise<string>;
}

export class OpenAIClient implements LLMClient {
  private client: OpenAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string = "gpt-4o") {
    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
    this.modelName = modelName;
  }

  async generate(systemPrompt: string, messages: OpenAIChatMessage[]): Promise<string> {
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [
        {
          role: "system",
          content: systemPrompt
        },
        ...messages.filter(msg => msg.role !== "system").map((msg): OpenAI.Chat.Completions.ChatCompletionMessageParam => {
          // Handle both string and array content for vision models
          if (msg.role === "user") {
            if (typeof msg.content === "string") {
              return {
                role: "user",
                content: msg.content,
              };
            } else {
              return {
                role: "user",
                content: msg.content.map(item => {
                  if (item.type === "text") {
                    return { type: "text" as const, text: item.text || "" };
                  } else if (item.type === "image_url" && item.image_url) {
                    return { type: "image_url" as const, image_url: item.image_url };
                  }
                  return { type: "text" as const, text: "" };
                }).filter(Boolean)
              };
            }
          } else {
            // Assistant role
            return {
              role: "assistant",
              content: typeof msg.content === "string" ? msg.content : msg.content.map(item => item.text || "").join(""),
            };
          }
        })
      ];

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages: openaiMessages,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || "";
  }
}

export class GoogleClient implements LLMClient {
  private client: GoogleGenAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string = "gemini-2.5-pro") {
    this.client = new GoogleGenAI({apiKey: apiKey});
    this.modelName = modelName;
  }

  async generate(systemPrompt: string, messages: OpenAIChatMessage[]): Promise<string> {
    // Messages are already in OpenAI format
    
    const geminiMessages = convertToGeminiFormat(messages);

    const result = await this.client.models.generateContent({
      model: this.modelName,
      contents: geminiMessages,
      config: {
        systemInstruction: systemPrompt,
      }
    });
    return result?.text || "";
  }
}

export class AnthropicClient implements LLMClient {
  private client: Anthropic;
  private modelName: string;

  constructor(apiKey: string, modelName: string = "claude-3-7-sonnet-latest") {
    this.client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
    this.modelName = modelName;
  }

  async generate(systemPrompt: string, messages: OpenAIChatMessage[]): Promise<string> {
    // Messages are already in OpenAI format
    
    const anthropicMessages = convertToAnthropicFormat(messages);

    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 10000,
      thinking: {
        type: "enabled",
        budget_tokens: 1024
      },
      messages: anthropicMessages,
      system: systemPrompt,
    });

    // Find the first text content block, ignoring thinking blocks
    const textContent = response.content.find(block => block.type === "text");
    return textContent?.type === "text" ? textContent.text : "";
  }
}

export class XAIClient implements LLMClient {
  private client: OpenAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string = "grok-4") {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.x.ai/v1",
      dangerouslyAllowBrowser: true,
    });
    this.modelName = modelName;
  }

  async generate(systemPrompt: string, messages: OpenAIChatMessage[]): Promise<string> {
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [
        {
          role: "system",
          content: systemPrompt
        },
        ...messages.filter(msg => msg.role !== "system").map((msg): OpenAI.Chat.Completions.ChatCompletionMessageParam => {
          // Handle both string and array content for vision models
          if (msg.role === "user") {
            if (typeof msg.content === "string") {
              return {
                role: "user",
                content: msg.content,
              };
            } else {
              return {
                role: "user",
                content: msg.content.map(item => {
                  if (item.type === "text") {
                    return { type: "text" as const, text: item.text || "" };
                  } else if (item.type === "image_url" && item.image_url) {
                    return { type: "image_url" as const, image_url: item.image_url };
                  }
                  return { type: "text" as const, text: "" };
                }).filter(Boolean)
              };
            }
          } else {
            // Assistant role
            return {
              role: "assistant",
              content: typeof msg.content === "string" ? msg.content : msg.content.map(item => item.text || "").join(""),
            };
          }
        })
      ];

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages: openaiMessages,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || "";
  }
}

export function createLLMClient(model: ModelConfig): LLMClient | null {
  const apiKeys = {
    openai: import.meta.env.VITE_OPENAI_API_KEY,
    google: import.meta.env.VITE_GOOGLE_API_KEY,
    anthropic: import.meta.env.VITE_ANTHROPIC_API_KEY,
    xai: import.meta.env.VITE_XAI_API_KEY,
  };

  const apiKey = apiKeys[model.provider];
  if (!apiKey) {
    console.warn(`No API key found for provider: ${model.provider}`);
    return null;
  }

  switch (model.provider) {
    case "openai":
      return new OpenAIClient(apiKey, model.name);
    case "google":
      return new GoogleClient(apiKey, model.name);
    case "anthropic":
      return new AnthropicClient(apiKey, model.name);
    case "xai":
      return new XAIClient(apiKey, model.name);
    default:
      return null;
  }
}
