import { describe, expect, it } from "vitest";

import { createSuggestionEngine } from "./textAutocomplete";

import type App from "../components/App";

// Minimal stub — the engine only ever touches app.scene.getNonDeletedElements
// to build its corpus, so we only need to stub that.
const makeStubApp = (sceneTexts: string[] = []): App => {
  const elements = sceneTexts.map((text, i) => ({
    id: `t${i}`,
    type: "text",
    text,
    isDeleted: false,
  }));
  return {
    scene: {
      getNonDeletedElements: () => elements,
    },
  } as unknown as App;
};

describe("createSuggestionEngine", () => {
  it("suggests a built-in diagramming term from a 3-char prefix", () => {
    const engine = createSuggestionEngine(makeStubApp());
    expect(engine.getSuggestion("Dec", 3, "id")).toBe("ision");
  });

  it("preserves user-typed case and only appends the suffix", () => {
    const engine = createSuggestionEngine(makeStubApp());
    // user typed lowercase — completion should still be the missing
    // characters using the corpus word's spelling
    expect(engine.getSuggestion("dec", 3, "id")).toBe("ision");
  });

  it("returns null when the caret is not at the end of the text", () => {
    const engine = createSuggestionEngine(makeStubApp());
    // caret at offset 2 ("De|c") — mid-word caret never suggests
    expect(engine.getSuggestion("Dec", 2, "id")).toBeNull();
  });

  it("requires at least 2 characters before suggesting", () => {
    const engine = createSuggestionEngine(makeStubApp());
    expect(engine.getSuggestion("D", 1, "id")).toBeNull();
    expect(engine.getSuggestion("De", 2, "id")).not.toBeNull();
  });

  it("only suggests the current word, not the whole text", () => {
    const engine = createSuggestionEngine(makeStubApp());
    // After a space the prefix is just "Logi", not the whole "User Logi" —
    // proves we split on whitespace before matching.
    expect(engine.getSuggestion("User Logi", 9, "id")).toBe("n");
  });

  it("returns null when no corpus word matches the prefix", () => {
    const engine = createSuggestionEngine(makeStubApp());
    expect(engine.getSuggestion("xyz", 3, "id")).toBeNull();
  });

  it("returns null when prefix already equals the corpus word", () => {
    const engine = createSuggestionEngine(makeStubApp());
    expect(engine.getSuggestion("Decision", 8, "id")).toBeNull();
  });

  it("does not suggest while the prefix ends in punctuation", () => {
    const engine = createSuggestionEngine(makeStubApp());
    expect(engine.getSuggestion("Dec.", 4, "id")).toBeNull();
  });

  it("picks up words from text elements already on the canvas", () => {
    const engine = createSuggestionEngine(
      makeStubApp(["Onboarding flow", "Quickstart guide"]),
    );
    // "Onboarding" wasn't in the built-in corpus
    expect(engine.getSuggestion("Onb", 3, "id")).toBe("oarding");
    expect(engine.getSuggestion("Qui", 3, "id")).toBe("ckstart");
  });

  it("refreshes the corpus when called", () => {
    const elements: {
      id: string;
      type: string;
      text: string;
      isDeleted: boolean;
    }[] = [];
    const stubApp = {
      scene: { getNonDeletedElements: () => elements },
    } as unknown as App;
    const engine = createSuggestionEngine(stubApp);
    expect(engine.getSuggestion("Zoo", 3, "id")).toBeNull();
    elements.push({
      id: "x",
      type: "text",
      text: "Zookeeper",
      isDeleted: false,
    });
    engine.refreshCorpus();
    expect(engine.getSuggestion("Zoo", 3, "id")).toBe("keeper");
  });
});
