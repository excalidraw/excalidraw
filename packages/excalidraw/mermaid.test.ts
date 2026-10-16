import { isMaybeMermaidDefinition, replaceMermaidLineBreaks } from "./mermaid";

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
});

describe("replaceMermaidLineBreaks", () => {
  it("should replace <br> tags with newlines", () => {
    expect(replaceMermaidLineBreaks("line1<br>line2")).toBe("line1\nline2");
    expect(replaceMermaidLineBreaks("line1<br/>line2")).toBe("line1\nline2");
    expect(replaceMermaidLineBreaks("line1<br />line2")).toBe("line1\nline2");
    expect(replaceMermaidLineBreaks("line1<br>line2<br>line3")).toBe(
      "line1\nline2\nline3",
    );
  });

  it("should be case-insensitive", () => {
    expect(replaceMermaidLineBreaks("line1<BR>line2")).toBe("line1\nline2");
  });

  it("should leave text without <br> tags unchanged", () => {
    expect(replaceMermaidLineBreaks("plain text")).toBe("plain text");
    expect(replaceMermaidLineBreaks("already\nbroken")).toBe("already\nbroken");
  });
});
