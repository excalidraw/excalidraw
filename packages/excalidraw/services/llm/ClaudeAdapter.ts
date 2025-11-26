/**
 * ClaudeAdapter
 *
 * Adapter for AWS Bedrock Claude models
 * Uses AWS Signature V4 authentication
 */

import {
  DEFAULT_MERMAID_PROMPT,
  LLMProviderError,
  RateLimitError,
  AuthenticationError,
  InvalidResponseError,
} from "./LLMProviderAdapter";

import type {
  ProviderCredentials,
  ConnectionTestResult,
  ModelInfo,
} from "../AIConfigurationService";
import type {
  AnalysisOptions,
  AnalysisResult,
  LLMProviderAdapter,
} from "./LLMProviderAdapter";

const CLAUDE_MODELS: ModelInfo[] = [
  // Claude Inference Profiles available in your AWS Bedrock
  {
    id: "us.anthropic.claude-opus-4-1-20250805-v1:0",
    name: "Claude Opus 4.1",
    description: "Most capable Claude model for complex tasks",
    capabilities: ["vision", "code", "reasoning", "analysis", "complex-tasks"],
    contextWindow: 200000,
  },
  {
    id: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
    name: "Claude Sonnet 4.5",
    description: "Enhanced Claude 4.5 model with improved capabilities",
    capabilities: ["vision", "code", "reasoning", "fast", "analysis"],
    contextWindow: 200000,
  },
  {
    id: "us.anthropic.claude-sonnet-4-20250514-v1:0",
    name: "Claude Sonnet 4",
    description: "Balanced Claude 4 model with superior reasoning",
    capabilities: ["vision", "code", "reasoning", "fast", "analysis"],
    contextWindow: 200000,
  },
  {
    id: "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
    name: "Claude 3.7 Sonnet",
    description: "Advanced Claude 3.7 model",
    capabilities: ["vision", "code", "reasoning", "fast"],
    contextWindow: 200000,
  },
  {
    id: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    name: "Claude Haiku 4.5",
    description: "Fastest and most affordable Claude model",
    capabilities: ["vision", "code", "fast", "affordable"],
    contextWindow: 200000,
  },
];

/**
 * AWS Signature V4 signing utility
 */
class AWSSignatureV4 {
  private static async sha256(message: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    return await crypto.subtle.digest("SHA-256", data);
  }

  private static async hmac(
    key: ArrayBuffer | string,
    message: string,
  ): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const keyData =
      typeof key === "string" ? encoder.encode(key) : new Uint8Array(key);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    return await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  }

  private static bufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  static async sign(
    method: string,
    url: string,
    headers: Record<string, string>,
    body: string,
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
    },
  ): Promise<Record<string, string>> {
    const urlObj = new URL(url);
    const host = urlObj.hostname;
    // AWS expects the path to be URL-encoded in the canonical request
    // For Bedrock, we need to encode colons in model IDs
    // Split by / and encode each segment, preserving the slashes
    const path = urlObj.pathname
      .split('/')
      .map(segment => {
        // Encode the segment but preserve unreserved characters
        // AWS uses RFC 3986 encoding
        return encodeURIComponent(segment).replace(/%2F/g, '/');
      })
      .join('/');
    const service = "bedrock";

    // Create timestamp
    const now = new Date();
    const amzDate = now
      .toISOString()
      .replace(/[:-]|\.\d{3}/g, "")
      .slice(0, -1);
    const dateStamp = amzDate.slice(0, 8);

    // Create canonical request
    const payloadHash = this.bufferToHex(await this.sha256(body));

    const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-date";

    const canonicalRequest = [
      method,
      path,
      "", // query string
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    // Debug logging
    console.log("Canonical Request:", canonicalRequest);
    console.log("Canonical Request Hash:", this.bufferToHex(await this.sha256(canonicalRequest)));

    // Create string to sign
    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${credentials.region}/${service}/aws4_request`;
    const canonicalRequestHash = this.bufferToHex(
      await this.sha256(canonicalRequest),
    );

    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      canonicalRequestHash,
    ].join("\n");

    // Debug logging
    console.log("String to Sign:", stringToSign);

    // Calculate signature
    const kDate = await this.hmac(
      `AWS4${credentials.secretAccessKey}`,
      dateStamp,
    );
    const kRegion = await this.hmac(kDate, credentials.region);
    const kService = await this.hmac(kRegion, service);
    const kSigning = await this.hmac(kService, "aws4_request");
    const signature = this.bufferToHex(await this.hmac(kSigning, stringToSign));

    // Create authorization header
    const authorizationHeader = `${algorithm} Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      Authorization: authorizationHeader,
      "X-Amz-Date": amzDate,
      "Content-Type": "application/json",
    };
  }
}

export class ClaudeAdapter implements LLMProviderAdapter {
  private getBedrockEndpoint(region: string): string {
    return `https://bedrock-runtime.${region}.amazonaws.com`;
  }

  async testConnection(
    credentials: ProviderCredentials["credentials"],
  ): Promise<ConnectionTestResult> {
    try {
      // Check authentication method: Bearer Token, API Key, or IAM credentials
      const useBearerToken = !!credentials.awsBearerToken;
      const useApiKey = !!credentials.apiKey;
      const useIAM = !!(credentials.awsClientId && credentials.awsClientSecret && credentials.awsRegion);
      
      if (!useBearerToken && !useApiKey && !useIAM) {
        return {
          success: false,
          message: "Missing credentials",
          error: "Either Bearer Token, API Key, or AWS IAM credentials are required",
        };
      }

      if ((useBearerToken || useApiKey) && !credentials.awsRegion) {
        return {
          success: false,
          message: "Missing region",
          error: "AWS Region is required",
        };
      }

      // Test with a simple invoke request to verify credentials
      // Use the inference profile ID for on-demand throughput
      const inferenceProfileId = "us.anthropic.claude-sonnet-4-20250514-v1:0";
      const endpoint = this.getBedrockEndpoint(credentials.awsRegion!);
      const url = `${endpoint}/model/${inferenceProfileId}/invoke`;

      const body = JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 10,
        messages: [
          {
            role: "user",
            content: "Hi",
          },
        ],
      });

      let headers: Record<string, string>;

      if (useBearerToken) {
        // Use bearer token authentication
        headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${credentials.awsBearerToken}`,
        };
      } else if (useApiKey) {
        // Use API key authentication
        headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${credentials.apiKey}`,
          "X-Api-Key": credentials.apiKey!,
        };
      } else {
        // Use AWS Signature V4 authentication
        headers = await AWSSignatureV4.sign("POST", url, {
          "Content-Type": "application/json",
        }, body, {
          accessKeyId: credentials.awsClientId!,
          secretAccessKey: credentials.awsClientSecret!,
          region: credentials.awsRegion!,
        });
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AWS Bedrock error:", errorText);
        
        if (response.status === 403) {
          return {
            success: false,
            message: "Invalid credentials",
            error: "Authentication failed. Please check your credentials.",
          };
        }
        return {
          success: false,
          message: "Connection failed",
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const models = await this.fetchModels(credentials);

      return {
        success: true,
        message: "Connected successfully to AWS Bedrock",
        availableModels: models,
      };
    } catch (error) {
      return {
        success: false,
        message: "Connection failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async fetchModels(
    credentials: ProviderCredentials["credentials"],
  ): Promise<ModelInfo[]> {
    // Return predefined Claude models available on Bedrock
    return CLAUDE_MODELS;
  }

  async analyzeImage(
    credentials: ProviderCredentials["credentials"],
    imageDataUrl: string,
    options?: AnalysisOptions,
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      // Check authentication method: Bearer Token, API Key, or IAM credentials
      const useBearerToken = !!credentials.awsBearerToken;
      const useApiKey = !!credentials.apiKey;
      const useIAM = !!(credentials.awsClientId && credentials.awsClientSecret && credentials.awsRegion);
      
      if (!useBearerToken && !useApiKey && !useIAM) {
        throw new AuthenticationError("claude");
      }

      if ((useBearerToken || useApiKey) && !credentials.awsRegion) {
        throw new AuthenticationError("claude");
      }

      const prompt = options?.prompt || DEFAULT_MERMAID_PROMPT;
      const maxTokens = options?.maxTokens || 2000;
      const temperature = options?.temperature ?? 0.1;

      // Extract base64 data and media type from data URL
      const [mediaTypePart, base64Data] = imageDataUrl.split(",");
      const mediaType = mediaTypePart.split(":")[1].split(";")[0];

      // Use the inference profile ID for on-demand throughput
      const inferenceProfileId = "us.anthropic.claude-sonnet-4-20250514-v1:0";
      const endpoint = this.getBedrockEndpoint(credentials.awsRegion!);
      const url = `${endpoint}/model/${inferenceProfileId}/invoke`;

      const requestBody = JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: maxTokens,
        temperature,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      });

      let headers: Record<string, string>;

      if (useBearerToken) {
        // Use bearer token authentication
        headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${credentials.awsBearerToken}`,
        };
      } else if (useApiKey) {
        // Use API key authentication
        headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${credentials.apiKey}`,
          "X-Api-Key": credentials.apiKey!,
        };
      } else {
        // Use AWS Signature V4 authentication
        headers = await AWSSignatureV4.sign(
          "POST",
          url,
          {},
          requestBody,
          {
            accessKeyId: credentials.awsClientId!,
            secretAccessKey: credentials.awsClientSecret!,
            region: credentials.awsRegion!,
          },
        );
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: requestBody,
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await response.json();

      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new InvalidResponseError(
          "claude",
          "No response content in API response",
        );
      }

      const mermaidCode = data.content[0].text.trim();
      const processingTime = Date.now() - startTime;

      return {
        mermaidCode,
        tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens,
        processingTime,
      };
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error;
      }
      throw new LLMProviderError(
        "Failed to analyze image",
        "claude",
        undefined,
        error instanceof Error ? error : undefined,
      );
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const status = response.status;

    if (status === 403) {
      throw new AuthenticationError("claude");
    }

    if (status === 429) {
      throw new RateLimitError("claude");
    }

    let errorMessage = `HTTP ${status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // Ignore JSON parse errors
    }

    throw new LLMProviderError(errorMessage, "claude", status);
  }
}
