export const isValidMermaidSyntax = (content: string): boolean => {
  const trimmed = content.trim();
  if (!trimmed) {
    return false;
  }

  const openBrackets = (trimmed.match(/\[/g) || []).length;
  const closeBrackets = (trimmed.match(/\]/g) || []).length;
  const openBraces = (trimmed.match(/\{/g) || []).length;
  const closeBraces = (trimmed.match(/\}/g) || []).length;
  const openParens = (trimmed.match(/\(/g) || []).length;
  const closeParens = (trimmed.match(/\)/g) || []).length;

  if (
    openBrackets !== closeBrackets ||
    openBraces !== closeBraces ||
    openParens !== closeParens
  ) {
    return false;
  }

  const lastLine = trimmed.split("\n").pop()?.trim() || "";
  const incompletePatterns = [
    /-->$/,
    /--$/,
    /-\.$/,
    /==>$/,
    /==$/,
    /~~$/,
    /::$/,
    /:$/,
    /\|$/,
    /&$/,
  ];

  if (incompletePatterns.some((pattern) => pattern.test(lastLine))) {
    return false;
  }

  return true;
};
