import { isValidHexColor } from "../src/colors";

describe("isValidHexColor", () => {
  it("deve retornar true para um código hexadecimal válido de 6 dígitos", () => {
    expect(isValidHexColor("#FF0000")).toBe(true);
  });
});


it("deve retornar true para um código hexadecimal válido de 3 dígitos", () => {
  expect(isValidHexColor("#F00")).toBe(true);
});
it("deve retornar false se não começar com #", () => {
  expect(isValidHexColor("FF0000")).toBe(false);
});
it("deve retornar false se tiver comprimento inválido", () => {
  expect(isValidHexColor("#F000")).toBe(false);
});
it("deve retornar false se contiver caracteres inválidos", () => {
  expect(isValidHexColor("#GGHHII")).toBe(false);
});