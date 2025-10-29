import { polygonIncludesPointNonZero } from "../src/polygon";

describe("polygonIncludesPointNonZero", () => {
  const square = [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
  ];

  it("retorna true para ponto dentro do polígono", () => {
    expect(polygonIncludesPointNonZero([1, 1], square)).toBe(true);
  });

  it("retorna false para ponto fora do polígono", () => {
    expect(polygonIncludesPointNonZero([3, 3], square)).toBe(false);
  });

  it("retorna false para ponto sobre uma aresta", () => {
    expect(polygonIncludesPointNonZero([2, 1], square)).toBe(false);
  });

  it("retorna true para ponto no vértice", () => {
    expect(polygonIncludesPointNonZero([0, 0], square)).toBe(true);
  });

  it("retorna true para ponto dentro de polígono com winding negativo", () => {
    const reversed = [...square].reverse();
    expect(polygonIncludesPointNonZero([1, 1], reversed)).toBe(true);
  });

});