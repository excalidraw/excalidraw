// Mermaid Renderer - Uses Mermaid.js to render diagrams client-side

import mermaid from "mermaid";

// Initialize Mermaid with configuration
mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose",
  fontFamily: "Virgil, Segoe UI Emoji",
});

/**
 * Render Mermaid code to SVG using Mermaid.js library
 * This runs entirely in the browser - no backend needed!
 */
export async function renderMermaidToSVG(mermaidCode: string): Promise<string> {
  try {
    // Clean up the Mermaid code - remove markdown code fences if present
    let cleanCode = mermaidCode.trim();

    // Remove ```mermaid and ``` fences
    cleanCode = cleanCode.replace(/^```mermaid\s*/i, "");
    cleanCode = cleanCode.replace(/^```\s*/m, "");
    cleanCode = cleanCode.replace(/```\s*$/m, "");
    cleanCode = cleanCode.trim();

    // Ensure proper line breaks (Mermaid needs them)
    // If the code is all on one line, try to add line breaks
    if (!cleanCode.includes("\n")) {
      console.log("Mermaid code has no line breaks, reformatting...");

      // More aggressive line break insertion
      // 1. Add line break after graph type declaration
      cleanCode = cleanCode.replace(/^(graph\s+\w+)/, "$1\n");

      // 2. Add line break before each node definition (e.g., M[Model])
      cleanCode = cleanCode.replace(/([A-Z]\w*)\[/g, "\n    $1[");

      // 3. Add line break before each edge (e.g., M -- text --> V)
      cleanCode = cleanCode.replace(/([A-Z]\w*)\s*(--)/g, "\n    $1 $2");

      // 4. Clean up multiple consecutive line breaks
      cleanCode = cleanCode.replace(/\n\n+/g, "\n");

      cleanCode = cleanCode.trim();
      console.log("Reformatted Mermaid code:", cleanCode);
    }

    // Generate unique ID for this diagram
    const id = `mermaid-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Render Mermaid code to SVG
    const { svg } = await mermaid.render(id, cleanCode);

    console.log("=== Mermaid Rendering ===");
    console.log("Input code:", cleanCode);
    console.log("SVG length:", svg.length);
    console.log("SVG preview:", svg.substring(0, 500));

    // Log SVG structure for debugging
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svg, "image/svg+xml");
    const svgEl = svgDoc.querySelector("svg");
    if (svgEl) {
      console.log("SVG structure:");
      console.log("- g elements:", svgEl.querySelectorAll("g").length);
      console.log(
        "- g.node elements:",
        svgEl.querySelectorAll("g.node").length,
      );
      console.log(
        "- g.edge elements:",
        svgEl.querySelectorAll("g.edge").length,
      );
      console.log("- path elements:", svgEl.querySelectorAll("path").length);
      console.log("- rect elements:", svgEl.querySelectorAll("rect").length);
      console.log("- text elements:", svgEl.querySelectorAll("text").length);
    }

    return svg;
  } catch (error) {
    console.error("Failed to render Mermaid diagram:", error);
    throw new Error(`Mermaid rendering failed: ${error}`);
  }
}

/**
 * Validate Mermaid syntax
 */
export async function validateMermaidSyntax(
  mermaidCode: string,
): Promise<boolean> {
  try {
    const id = `mermaid-validate-${Date.now()}`;
    await mermaid.render(id, mermaidCode);
    return true;
  } catch (error) {
    return false;
  }
}
