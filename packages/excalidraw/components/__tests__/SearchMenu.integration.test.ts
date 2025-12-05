import { describe, expect, it } from "vitest";
import type { SearchMatchItem } from "../SearchMenu";
import { getStableMatches } from "../SearchMenu.utils";

/**
 * Integration tests for SearchMenu MatchList stable ordering
 * Verifies that results maintain consistent order despite scene updates
 */

describe("SearchMenu - Stable Ordering Integration", () => {
  const createMockSearchMatchItem = (
    elementId: string,
    matchIndex: number = 0,
    previewText: string = elementId,
  ): SearchMatchItem => ({
    element: {
      id: elementId,
      type: "text",
      text: previewText,
    } as any,
    searchQuery: "test" as any,
    index: matchIndex,
    preview: {
      indexInSearchQuery: 0,
      previewText: previewText,
      moreBefore: false,
      moreAfter: false,
    },
    matchedLines: [],
  });

  it("getStableMatches produz ordem consistente após múltiplas reordenações de entrada", () => {
    const items1 = [
      createMockSearchMatchItem("element-3"),
      createMockSearchMatchItem("element-1"),
      createMockSearchMatchItem("element-2"),
    ];

    const items2 = [
      createMockSearchMatchItem("element-2"),
      createMockSearchMatchItem("element-3"),
      createMockSearchMatchItem("element-1"),
    ];

    const sorted1 = getStableMatches(items1);
    const sorted2 = getStableMatches(items2);

    const ids1 = sorted1.map((m) => m.element.id);
    const ids2 = sorted2.map((m) => m.element.id);

    expect(ids1).toEqual(ids2);
    expect(ids1).toEqual(["element-1", "element-2", "element-3"]);
  });

  it("getStableMatches mantém ordem quando múltiplos matches no mesmo elemento existem", () => {
    const items = [
      createMockSearchMatchItem("text-b", 2),
      createMockSearchMatchItem("text-b", 0),
      createMockSearchMatchItem("text-a", 0),
      createMockSearchMatchItem("text-b", 1),
    ];

    const sorted = getStableMatches(items);

    const result = sorted.map((m) => `${m.element.id}[${m.index}]`);
    expect(result).toEqual([
      "text-a[0]",
      "text-b[0]",
      "text-b[1]",
      "text-b[2]",
    ]);
  });

  it("simula cenário: elemento é movido no canvas (scene update) enquanto busca está ativa", () => {
    // Estado inicial: busca encontra A, B, C
    const initialMatches = [
      createMockSearchMatchItem("element-a", 0, "test alpha"),
      createMockSearchMatchItem("element-b", 0, "test beta"),
      createMockSearchMatchItem("element-c", 0, "test gamma"),
    ];

    const sortedInitial = getStableMatches(initialMatches);
    const initialOrder = sortedInitial.map((m) => m.element.id);

    // Simulate: element B é movido (x, y muda) na scene
    // Callbacks de search disparam novamente com mesmos elementos mas potencialmente reordenados
    const afterElementMove = [
      createMockSearchMatchItem("element-c", 0, "test gamma"), // pode aparecer em ordem diferente
      createMockSearchMatchItem("element-a", 0, "test alpha"),
      createMockSearchMatchItem("element-b", 0, "test beta"),
    ];

    const sortedAfterMove = getStableMatches(afterElementMove);
    const orderAfterMove = sortedAfterMove.map((m) => m.element.id);

    // A ordem deve permanecer a mesma, apesar da reordenação de entrada
    expect(orderAfterMove).toEqual(initialOrder);
    expect(orderAfterMove).toEqual(["element-a", "element-b", "element-c"]);
  });

  it("verifica que IDs são chaves únicas estáveis sem colisão de concatenação", () => {
    // Teste para evitar colisões do tipo: "elem1" + "2" == "elem" + "12"
    const items = [
      createMockSearchMatchItem("elem1", 2), // sem separador: "elem12"
      createMockSearchMatchItem("elem", 12), // sem separador: "elem12" (colisão!)
    ];

    const sorted = getStableMatches(items);

    // Com ordenação por ID e index, nunca haverá confusão
    expect(sorted[0].element.id).toBe("elem");
    expect(sorted[1].element.id).toBe("elem1");
  });

  it("trata edge case: nenhum match", () => {
    const matches: SearchMatchItem[] = [];
    const sorted = getStableMatches(matches);
    expect(sorted).toEqual([]);
  });

  it("trata edge case: um único match", () => {
    const matches = [createMockSearchMatchItem("single-element", 0)];
    const sorted = getStableMatches(matches);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].element.id).toBe("single-element");
  });

  it("preserva ordem idêntica em chamadas sucessivas (idempotência)", () => {
    const original = [
      createMockSearchMatchItem("z-element", 0),
      createMockSearchMatchItem("a-element", 1),
      createMockSearchMatchItem("m-element", 0),
    ];

    const round1 = getStableMatches(original);
    const round2 = getStableMatches(round1);
    const round3 = getStableMatches(round2);

    const ids1 = round1.map((m) => `${m.element.id}[${m.index}]`).join(",");
    const ids2 = round2.map((m) => `${m.element.id}[${m.index}]`).join(",");
    const ids3 = round3.map((m) => `${m.element.id}[${m.index}]`).join(",");

    expect(ids1).toBe(ids2);
    expect(ids2).toBe(ids3);
  });
});
