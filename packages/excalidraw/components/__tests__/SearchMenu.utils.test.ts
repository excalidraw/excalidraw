import { describe, expect, it } from "vitest";
import type { SearchMatchItem } from "../SearchMenu";
import { getStableMatches } from "../SearchMenu.utils";

describe("getStableMatches", () => {
  const createMockMatch = (
    elementId: string,
    matchIndex: number = 0,
  ): SearchMatchItem => ({
    element: {
      id: elementId,
      type: "text",
    } as any,
    searchQuery: "test" as any,
    index: matchIndex,
    preview: {
      indexInSearchQuery: 0,
      previewText: "test",
      moreBefore: false,
      moreAfter: false,
    },
    matchedLines: [],
  });

  it("ordena consistentemente por element.id quando os matches chegam em qualquer ordem", () => {
    const matches = [
      createMockMatch("C", 0),
      createMockMatch("A", 0),
      createMockMatch("B", 0),
    ];

    const sorted = getStableMatches(matches);

    expect(sorted.map((m) => m.element.id)).toEqual(["A", "B", "C"]);
  });

  it("ordena por element.id e depois por index dentro do mesmo elemento", () => {
    const matches = [
      createMockMatch("B", 0),
      createMockMatch("A", 1),
      createMockMatch("A", 0),
      createMockMatch("B", 1),
    ];

    const sorted = getStableMatches(matches);

    const result = sorted.map((m) => `${m.element.id}_${m.index}`);
    expect(result).toEqual(["A_0", "A_1", "B_0", "B_1"]);
  });

  it("retorna cópia não-mutante do array original", () => {
    const original = [
      createMockMatch("B", 0),
      createMockMatch("A", 0),
    ];
    const originalOrder = original.map((m) => m.element.id);

    const sorted = getStableMatches(original);

    // Verifica se original não foi modificado
    expect(original.map((m) => m.element.id)).toEqual(originalOrder);
    // Verifica se resultado está ordenado
    expect(sorted.map((m) => m.element.id)).toEqual(["A", "B"]);
  });

  it("mantém ordem estável mesmo se reordenado múltiplas vezes", () => {
    const originalMatches = [
      createMockMatch("C", 0),
      createMockMatch("B", 0),
      createMockMatch("A", 0),
    ];

    const sorted1 = getStableMatches(originalMatches);
    const sorted2 = getStableMatches(sorted1);
    const sorted3 = getStableMatches(sorted2);

    const result1 = sorted1.map((m) => m.element.id);
    const result2 = sorted2.map((m) => m.element.id);
    const result3 = sorted3.map((m) => m.element.id);

    expect(result1).toEqual(["A", "B", "C"]);
    expect(result2).toEqual(["A", "B", "C"]);
    expect(result3).toEqual(["A", "B", "C"]);
  });

  it("trata array vazio", () => {
    const sorted = getStableMatches([]);
    expect(sorted).toEqual([]);
  });

  it("trata array com um único elemento", () => {
    const matches = [createMockMatch("A", 0)];
    const sorted = getStableMatches(matches);
    expect(sorted).toEqual(matches);
  });
});
