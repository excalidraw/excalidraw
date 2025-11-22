/**
 * AI Features Export
 *
 * Central export for all AI-related features.
 * Import this file to add AI capabilities to Excalidraw.
 */

// Components
export { AIConfigurationDialog } from "./components/AIConfigurationDialog";
export { ImageToMermaidDialog } from "./components/ImageToMermaidDialog";
export { AIFeatureIntegration } from "./components/AIFeatureIntegration";
export {
  AIConfigButton,
  ImageImportButton,
} from "./components/AIToolbarButtons";

// Services
export { aiConfigService } from "./services/AIConfigurationService";
export { llmVisionService } from "./services/LLMVisionService";
export { imageProcessingService } from "./services/ImageProcessingService";
export { mermaidValidationService } from "./services/MermaidValidationService";
export { conversionOrchestrationService } from "./services/ConversionOrchestrationService";

// Types
export type {
  LLMProvider,
  ProviderCredentials,
  ModelInfo,
  ConfigurationStatus,
} from "./services/AIConfigurationService";

export type {
  ConversionOptions,
  ConversionStatus,
  ConversionResult,
} from "./services/ConversionOrchestrationService";

export type {
  ProcessedImage,
  ValidationResult as ImageValidationResult,
} from "./services/ImageProcessingService";

export type {
  ValidationResult as MermaidValidationResult,
  ValidationError,
  CorrectionResult,
} from "./services/MermaidValidationService";

// Actions
export { actionConfigureAI, actionImportImage } from "./actions/actionAI";

// Utilities
export {
  convertMermaidToElements,
  insertElementsIntoCanvas,
} from "./utils/mermaidToExcalidraw";

// Atoms (for state management)
export {
  aiConfigDialogOpenAtom,
  aiConfiguredProvidersAtom,
  aiSelectedProviderAtom,
  aiSelectedModelAtom,
  aiAvailableModelsAtom,
  aiConfigurationStatusAtom,
  imageToMermaidDialogOpenAtom,
  conversionProgressAtom,
  conversionResultAtom,
  conversionStatusAtom,
  conversionErrorAtom,
  processingImageAtom,
  showConfigPromptAtom,
} from "./editor-jotai";
