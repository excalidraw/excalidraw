import { isMaybeMermaidDefinition } from "./mermaid";

describe("isMaybeMermaidDefinition", () => {
  it("should return true for a valid mermaid definition", () => {
    expect(isMaybeMermaidDefinition("flowchart")).toBe(true);
    expect(isMaybeMermaidDefinition("flowchart LR")).toBe(true);
    expect(isMaybeMermaidDefinition("flowchart LR\nola")).toBe(true);
    expect(isMaybeMermaidDefinition("%%{}%%flowchart")).toBe(true);
    expect(isMaybeMermaidDefinition("%%{}%% flowchart")).toBe(true);

    expect(isMaybeMermaidDefinition("graphs")).toBe(false);
    expect(isMaybeMermaidDefinition("this flowchart")).toBe(false);
    expect(isMaybeMermaidDefinition("this\nflowchart")).toBe(false);
  });

  it("should detect C4 diagram variants", () => {
    expect(isMaybeMermaidDefinition("C4Context")).toBe(true);
    expect(isMaybeMermaidDefinition("C4Container")).toBe(true);
    expect(isMaybeMermaidDefinition("C4Component")).toBe(true);
    expect(isMaybeMermaidDefinition("C4Dynamic")).toBe(true);
    expect(isMaybeMermaidDefinition("C4Deployment")).toBe(true);
  });

  it("should detect newer mermaid v11+ diagram types", () => {
    expect(isMaybeMermaidDefinition("architecture-beta")).toBe(true);
    expect(isMaybeMermaidDefinition("kanban")).toBe(true);
    expect(isMaybeMermaidDefinition("packet-beta")).toBe(true);
    expect(isMaybeMermaidDefinition("classDiagram-v2")).toBe(true);
  });
});
