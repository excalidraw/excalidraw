export interface HexValidationResult {
  isValid: boolean;
  errorKey?: string;
  normalizedValue?: string;
}

/**
 * Validates a hex color input and returns detailed validation result
 * @param input - The hex color input (with or without #)
 * @returns Validation result with error details
 */
export const validateHexColor = (input: string): HexValidationResult => {
  if (!input || input.trim() === "") {
    return { isValid: true }; // Empty input is valid (will be handled as no color)
  }

  // Remove # if present and convert to lowercase
  const cleanInput = input.replace(/^#/, "").toLowerCase().trim();

  // Check for valid length (3, 4, 6, or 8 characters)
  const validLengths = [3, 4, 6, 8];
  if (!validLengths.includes(cleanInput.length)) {
    return {
      isValid: false,
      errorKey: "colorPicker.hexCodeLength",
    };
  }

  // Check for valid hex characters (0-9, a-f)
  const hexPattern = /^[0-9a-f]+$/;
  if (!hexPattern.test(cleanInput)) {
    return {
      isValid: false,
      errorKey: "colorPicker.hexCodeCharacters",
    };
  }

  // If we get here, it's a valid hex color
  return {
    isValid: true,
    normalizedValue: `#${cleanInput}`,
  };
};

/**
 * Checks if a hex color is valid using browser's native validation
 * This is used as a fallback for edge cases
 */
export const isValidColorBrowser = (color: string): boolean => {
  const style = new Option().style;
  style.color = color;
  return !!style.color;
};
