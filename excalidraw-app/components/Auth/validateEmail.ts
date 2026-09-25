export const EMAIL_VALIDATION_MESSAGE = "Invalid email address. Please use only basic Latin characters (A-Z, 0-9) and standard symbols.";

interface ValidationError {
  code?: string;
  format?: string;
  message?: string;
}

export const parseEmailValidationError = (error: unknown): string => {
  // Try to parse JSON first
  if (typeof error === "string") {
    try {
      const parsed = JSON.parse(error);
      error = parsed;
    } catch {
      // If it's not valid JSON but a plain string, return default message
      return EMAIL_VALIDATION_MESSAGE;
    }
  }

  // Process JSON object/array
  try {
    const errorObj = error;
    
    // If it's an array, take first error
    if (Array.isArray(errorObj)) {
      const firstError = errorObj[0] as ValidationError;
      if (firstError?.code === "invalid_format" && firstError?.format === "email") {
        return EMAIL_VALIDATION_MESSAGE;
      }
      return firstError?.message || EMAIL_VALIDATION_MESSAGE;
    }
    
    // If it's an object
    const validationError = errorObj as ValidationError;
    if (validationError?.code === "invalid_format" && validationError?.format === "email") {
      return EMAIL_VALIDATION_MESSAGE;
    }
    return validationError?.message || EMAIL_VALIDATION_MESSAGE;
    
  } catch (e) {
    // If JSON parsing fails or any other error
    return EMAIL_VALIDATION_MESSAGE;
  }
};