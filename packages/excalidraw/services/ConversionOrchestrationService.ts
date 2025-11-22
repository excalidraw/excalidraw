/**
 * ConversionOrchestrationService
 *
 * Orchestrates the complete image-to-diagram conversion pipeline.
 * Coordinates ImageProcessing → LLMVision → MermaidValidation → Mermaid-to-Excalidraw
 */

import { aiConfigService } from "./AIConfigurationService";
import { llmVisionService } from "./LLMVisionService";
import { imageProcessingService } from "./ImageProcessingService";

import { mermaidValidationService } from "./MermaidValidationService";

import type { ProcessedImage } from "./ImageProcessingService";
import type { ValidationResult } from "./MermaidValidationService";

export interface ConversionOptions {
  validationLevel: "strict" | "lenient" | "none";
  maxRetries: number;
  timeout: number;
  progressCallback?: (status: ConversionStatus) => void;
}

export interface ConversionStatus {
  sessionId: string;
  stage:
    | "processing"
    | "analyzing"
    | "validating"
    | "refining"
    | "complete"
    | "error";
  progress: number; // 0-100
  message: string;
  result?: string;
  error?: Error;
}

export interface ConversionResult {
  sessionId: string;
  mermaidCode: string;
  validationResult: ValidationResult;
  processingTime: number;
  retryCount: number;
}

export interface RetryOptions {
  useRefinedPrompt?: boolean;
  customPrompt?: string;
}

export class ConversionOrchestrationService {
  private activeSessions: Map<string, ConversionStatus>;
  private abortControllers: Map<string, AbortController>;

  constructor() {
    this.activeSessions = new Map();
    this.abortControllers = new Map();
  }

  /**
   * Start image-to-diagram conversion
   */
  async startConversion(
    image: ProcessedImage,
    options?: Partial<ConversionOptions>,
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    const fullOptions: ConversionOptions = {
      validationLevel: options?.validationLevel || "lenient",
      maxRetries: options?.maxRetries || 3,
      timeout: options?.timeout || 60000, // 60 seconds
      progressCallback: options?.progressCallback,
    };

    // Check if AI is configured
    const isConfigured = await aiConfigService.isConfigured();
    if (!isConfigured) {
      throw new Error(
        "No AI provider configured. Please configure a provider first.",
      );
    }

    // Create abort controller for this session
    const abortController = new AbortController();
    this.abortControllers.set(sessionId, abortController);

    try {
      // Stage 1: Processing image
      this.updateStatus(
        sessionId,
        {
          sessionId,
          stage: "processing",
          progress: 10,
          message: "Optimizing image for analysis...",
        },
        fullOptions,
      );

      const optimizedImage = await imageProcessingService.optimizeForAnalysis(
        image,
      );

      // Stage 2: Analyzing with LLM
      this.updateStatus(
        sessionId,
        {
          sessionId,
          stage: "analyzing",
          progress: 30,
          message: "Analyzing image with AI...",
        },
        fullOptions,
      );

      let mermaidCode: string;
      let retryCount = 0;
      let validationResult: ValidationResult;

      // Retry loop for LLM analysis and validation
      while (retryCount < fullOptions.maxRetries) {
        // Check if aborted
        if (abortController.signal.aborted) {
          throw new Error("Conversion cancelled");
        }

        // Analyze image
        const analysisResult = await llmVisionService.analyzeImage(
          optimizedImage.dataUrl,
          {
            retryAttempts: 1, // Single attempt per loop iteration
          },
        );

        mermaidCode = analysisResult.mermaidCode;

        // Stage 3: Validating mermaid code
        this.updateStatus(
          sessionId,
          {
            sessionId,
            stage: "validating",
            progress: 60 + retryCount * 10,
            message: `Validating generated code (attempt ${retryCount + 1}/${
              fullOptions.maxRetries
            })...`,
          },
          fullOptions,
        );

        validationResult = await mermaidValidationService.validateSyntax(
          mermaidCode,
        );

        // Check validation level
        if (fullOptions.validationLevel === "none") {
          break; // Skip validation
        }

        if (validationResult.isValid) {
          break; // Valid code, exit loop
        }

        if (
          fullOptions.validationLevel === "lenient" &&
          validationResult.errors.length === 0
        ) {
          break; // Lenient mode, accept warnings
        }

        // Try auto-correction
        if (retryCount < fullOptions.maxRetries - 1) {
          this.updateStatus(
            sessionId,
            {
              sessionId,
              stage: "refining",
              progress: 70 + retryCount * 10,
              message: "Refining code with AI...",
            },
            fullOptions,
          );

          const correctionResult = await mermaidValidationService.autoCorrect(
            mermaidCode,
          );

          if (correctionResult.confidence > 0.7) {
            mermaidCode = correctionResult.correctedCode;
            validationResult = await mermaidValidationService.validateSyntax(
              mermaidCode,
            );

            if (validationResult.isValid) {
              break;
            }
          }
        }

        retryCount++;
      }

      // Stage 4: Complete
      this.updateStatus(
        sessionId,
        {
          sessionId,
          stage: "complete",
          progress: 100,
          message: "Conversion complete!",
          result: mermaidCode!,
        },
        fullOptions,
      );

      // Store result
      const result: ConversionResult = {
        sessionId,
        mermaidCode: mermaidCode!,
        validationResult: validationResult!,
        processingTime: Date.now() - parseInt(sessionId, 36),
        retryCount,
      };

      return mermaidCode!;
    } catch (error) {
      this.updateStatus(
        sessionId,
        {
          sessionId,
          stage: "error",
          progress: 0,
          message: error instanceof Error ? error.message : "Conversion failed",
          error: error instanceof Error ? error : new Error("Unknown error"),
        },
        fullOptions,
      );

      throw error;
    } finally {
      // Cleanup
      this.abortControllers.delete(sessionId);
    }
  }

  /**
   * Get conversion status
   */
  async getConversionStatus(
    sessionId: string,
  ): Promise<ConversionStatus | null> {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Cancel conversion
   */
  async cancelConversion(sessionId: string): Promise<void> {
    const abortController = this.abortControllers.get(sessionId);
    if (abortController) {
      abortController.abort();
    }

    this.updateStatus(sessionId, {
      sessionId,
      stage: "error",
      progress: 0,
      message: "Conversion cancelled by user",
      error: new Error("Cancelled"),
    });
  }

  /**
   * Retry conversion with different options
   */
  async retryConversion(
    sessionId: string,
    image: ProcessedImage,
    options?: RetryOptions,
  ): Promise<string> {
    // Start new conversion with refined options
    const conversionOptions: Partial<ConversionOptions> = {
      maxRetries: 3,
      validationLevel: "lenient",
    };

    return this.startConversion(image, conversionOptions);
  }

  /**
   * Update conversion status
   */
  private updateStatus(
    sessionId: string,
    status: ConversionStatus,
    options?: ConversionOptions,
  ): void {
    this.activeSessions.set(sessionId, status);

    if (options?.progressCallback) {
      options.progressCallback(status);
    }

    // Clean up completed/error sessions after 5 minutes
    if (status.stage === "complete" || status.stage === "error") {
      setTimeout(() => {
        this.activeSessions.delete(sessionId);
      }, 5 * 60 * 1000);
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}

// Export singleton instance
export const conversionOrchestrationService =
  new ConversionOrchestrationService();
