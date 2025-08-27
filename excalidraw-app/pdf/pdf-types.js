// PDF-specific types and utilities

// Helper to check if an element has PDF data
export const hasPDFData = (element) => {
  return element?.customData?.pdf != null;
};

// Helper to get PDF data from element
export const getPDFData = (element) => {
  if (hasPDFData(element) && element.customData && element.customData.pdf) {
    return element.customData.pdf;
  }
  return null;
};