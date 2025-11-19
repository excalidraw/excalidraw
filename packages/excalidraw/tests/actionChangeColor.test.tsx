import { actionChangeBackgroundColor } from "../actions/actionProperties";
import { API } from "./helpers/api";

describe("Action Change Color Integrity", () => {
  it("NÃO deve atualizar o elemento se a cor for inválida", () => {
    // 1. Setup: Cria um elemento com cor branca (#FFFFFF)
    const element = API.createElement({ type: "rectangle", backgroundColor: "#FFFFFF" });
    
    const mockAppState = {
       currentItemBackgroundColor: "#FFFFFF",
       viewBackgroundColor: "#FFFFFF",
    } as any;

    // 2. Execução: Usamos 'as any' na função para o TypeScript não reclamar dos tipos dos argumentos
    const result = (actionChangeBackgroundColor.perform as any)(
      [element], 
      mockAppState, 
      "#ZZZ", 
      {} 
    );

    // 3. Verificação: A cor deve permanecer #FFFFFF
    expect(result.elements[0].backgroundColor).toBe("#FFFFFF");
  });
});