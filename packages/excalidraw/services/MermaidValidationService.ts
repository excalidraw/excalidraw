/**
 * MermaidValidationService
 *
 * Validates and refines generated mermaid code.
 * Provides syntax checking and auto-correction capabilities.
 */

export interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationWarning {
  line: number;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  diagramType: string;
}

export interface CorrectionResult {
  correctedCode: string;
  changes: CodeChange[];
  confidence: number;
}

export interface CodeChange {
  line: number;
  original: string;
  corrected: string;
  reason: string;
}

export interface DiagramInfo {
  type: string;
  nodeCount: number;
  edgeCount: number;
  hasLabels: boolean;
}

export class MermaidValidationService {
  /**
   * Validate mermaid syntax
   */
  async validateSyntax(mermaidCode: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let diagramType = "unknown";

    try {
      // Clean the code
      const cleanedCode = this.cleanMermaidCode(mermaidCode);
      const lines = cleanedCode.split("\n");

      // Detect diagram type
      diagramType = this.detectDiagramType(cleanedCode);

      // Basic syntax validation
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith("%%")) {
          continue; // Skip empty lines and comments
        }

        // Check for common syntax errors
        if (i === 0) {
          // First line should be diagram type
          if (!this.isValidDiagramType(line)) {
            errors.push({
              line: i + 1,
              column: 0,
              message: `Invalid diagram type: ${line}`,
              severity: "error",
            });
          }
        } else {
          // Check for unmatched brackets
          if (this.hasUnmatchedBrackets(line)) {
            errors.push({
              line: i + 1,
              column: 0,
              message: "Unmatched brackets",
              severity: "error",
            });
          }

          // Check for invalid arrow syntax
          if (this.hasInvalidArrows(line)) {
            warnings.push({
              line: i + 1,
              message: "Potentially invalid arrow syntax",
            });
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        diagramType,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [
          {
            line: 0,
            column: 0,
            message:
              error instanceof Error ? error.message : "Validation failed",
            severity: "error",
          },
        ],
        warnings,
        diagramType,
      };
    }
  }

  /**
   * Suggest corrections for common syntax issues
   */
  async suggestCorrections(
    code: string,
    errors: ValidationError[],
  ): Promise<string[]> {
    const suggestions: string[] = [];

    for (const error of errors) {
      if (error.message.includes("Invalid diagram type")) {
        suggestions.push(
          "Try using a valid diagram type: flowchart, sequenceDiagram, classDiagram, stateDiagram, etc.",
        );
      }

      if (error.message.includes("Unmatched brackets")) {
        suggestions.push(
          "Check that all brackets [], (), {} are properly closed",
        );
      }

      if (error.message.includes("arrow")) {
        suggestions.push(
          "Use valid arrow syntax: -->, --->, -.-> for flowcharts",
        );
      }
    }

    return suggestions;
  }

  /**
   * Auto-correct common syntax errors
   */
  async autoCorrect(code: string): Promise<CorrectionResult> {
    const changes: CodeChange[] = [];
    let correctedCode = code;
    let confidence = 1.0;

    // Clean the code
    correctedCode = this.cleanMermaidCode(correctedCode);

    // Fix common issues
    const lines = correctedCode.split("\n");
    const correctedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const originalLine = line;

      // Remove markdown code block markers
      if (line.trim().startsWith("```")) {
        changes.push({
          line: i + 1,
          original: line,
          corrected: "",
          reason: "Removed markdown code block marker",
        });
        confidence *= 0.95;
        continue;
      }

      // Fix common arrow syntax issues
      if (line.includes("->") && !line.includes("-->")) {
        line = line.replace(/->/g, "-->");
        if (line !== originalLine) {
          changes.push({
            line: i + 1,
            original: originalLine,
            corrected: line,
            reason: "Fixed arrow syntax",
          });
          confidence *= 0.9;
        }
      }

      // Fix spacing issues
      line = line.replace(/\s+/g, " ").trim();

      correctedLines.push(line);
    }

    correctedCode = correctedLines.filter((l) => l.length > 0).join("\n");

    return {
      correctedCode,
      changes,
      confidence,
    };
  }

  /**
   * Get diagram information
   */
  async getDiagramInfo(code: string): Promise<DiagramInfo> {
    const cleanedCode = this.cleanMermaidCode(code);
    const type = this.detectDiagramType(cleanedCode);

    // Count nodes and edges (simplified)
    const lines = cleanedCode.split("\n");
    let nodeCount = 0;
    let edgeCount = 0;
    let hasLabels = false;

    for (const line of lines) {
      // Count arrows (edges)
      if (
        line.includes("-->") ||
        line.includes("---") ||
        line.includes("-.-")
      ) {
        edgeCount++;
      }

      // Count nodes (simplified - lines with brackets or parentheses)
      if (line.includes("[") || line.includes("(") || line.includes("{")) {
        nodeCount++;
      }

      // Check for labels
      if (line.includes("|") && line.includes("|")) {
        hasLabels = true;
      }
    }

    return {
      type,
      nodeCount,
      edgeCount,
      hasLabels,
    };
  }

  /**
   * Clean mermaid code by removing markdown and extra whitespace
   */
  private cleanMermaidCode(code: string): string {
    // Remove markdown code blocks
    let cleaned = code.replace(/```mermaid\n?/g, "").replace(/```\n?/g, "");

    // Remove extra whitespace
    cleaned = cleaned
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n");

    return cleaned;
  }

  /**
   * Detect diagram type from code
   */
  private detectDiagramType(code: string): string {
    const firstLine = code.split("\n")[0].trim().toLowerCase();

    if (firstLine.startsWith("flowchart") || firstLine.startsWith("graph")) {
      return "flowchart";
    }
    if (firstLine.startsWith("sequencediagram")) {
      return "sequence";
    }
    if (firstLine.startsWith("classdiagram")) {
      return "class";
    }
    if (firstLine.startsWith("statediagram")) {
      return "state";
    }
    if (firstLine.startsWith("erdiagram")) {
      return "er";
    }
    if (firstLine.startsWith("gantt")) {
      return "gantt";
    }
    if (firstLine.startsWith("pie")) {
      return "pie";
    }

    return "unknown";
  }

  /**
   * Check if line is a valid diagram type declaration
   */
  private isValidDiagramType(line: string): boolean {
    const validTypes = [
      "flowchart",
      "graph",
      "sequencediagram",
      "classdiagram",
      "statediagram",
      "erdiagram",
      "gantt",
      "pie",
      "journey",
      "gitgraph",
    ];

    const lowerLine = line.toLowerCase();
    return validTypes.some((type) => lowerLine.startsWith(type));
  }

  /**
   * Check for unmatched brackets
   */
  private hasUnmatchedBrackets(line: string): boolean {
    const brackets = { "[": "]", "(": ")", "{": "}" };
    const stack: string[] = [];

    for (const char of line) {
      if (char in brackets) {
        stack.push(char);
      } else if (Object.values(brackets).includes(char)) {
        const last = stack.pop();
        if (!last || brackets[last as keyof typeof brackets] !== char) {
          return true;
        }
      }
    }

    return stack.length > 0;
  }

  /**
   * Check for invalid arrow syntax
   */
  private hasInvalidArrows(line: string): boolean {
    // Check for single dash arrows (should be double or triple)
    return /[^-]->/.test(line) || /[^-]-[^->]/.test(line);
  }
}

// Export singleton instance
export const mermaidValidationService = new MermaidValidationService();
