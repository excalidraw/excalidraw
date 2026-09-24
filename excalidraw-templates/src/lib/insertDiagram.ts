import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";

export interface InsertDiagramResult {
  elementCount: number;
  filesCount: number;
}

type ConvertedElements = ReturnType<typeof convertToExcalidrawElements>;
type ParsedFiles = Awaited<
  ReturnType<typeof parseMermaidToExcalidraw>
>["files"];

export interface ParsedDiagram {
  elements: ConvertedElements;
  files: ParsedFiles;
  elementCount: number;
  filesCount: number;
}

/**
 * mermaid source -> skeleton -> scene-ready elements. Does NOT touch the
 * canvas — split out from commitDiagram so callers (the AI repair-retry
 * flow in App.tsx) can validate a result before ever drawing it, instead
 * of committing a broken/flat-image diagram and having to undo it.
 */
export async function parseDiagram(
  mermaidSource: string,
): Promise<ParsedDiagram> {
  const { elements: skeletonElements, files } =
    await parseMermaidToExcalidraw(mermaidSource);
  const elements = convertToExcalidrawElements(skeletonElements);

  return {
    elements,
    files,
    elementCount: elements.length,
    filesCount: files ? Object.keys(files).length : 0,
  };
}

export function commitDiagram(
  api: ExcalidrawImperativeAPI,
  parsed: ParsedDiagram,
): void {
  api.updateScene({ elements: parsed.elements });
  if (parsed.files && Object.keys(parsed.files).length > 0) {
    api.addFiles(Object.values(parsed.files));
  }
  api.scrollToContent(parsed.elements, { fitToContent: true });
}

/**
 * parseDiagram + commitDiagram in one call. Used by the no-AI template
 * fallback path (TemplateStrip), where the mermaid source is hand-vetted
 * and always safe to commit directly.
 */
export async function insertDiagram(
  api: ExcalidrawImperativeAPI,
  mermaidSource: string,
): Promise<InsertDiagramResult> {
  const parsed = await parseDiagram(mermaidSource);
  commitDiagram(api, parsed);
  return { elementCount: parsed.elementCount, filesCount: parsed.filesCount };
}
