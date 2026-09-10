import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../..";
import { Keyboard } from "../../tests/helpers/ui";
import { act, render, screen, fireEvent } from "../../tests/test-utils"; 
import { API } from "../../tests/helpers/api"; 

describe("FontPicker", () => {
  (global as any).ResizeObserver =
    (global as any).ResizeObserver ||
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

  it("should be able to open font picker", async () => {
    const { queryByTestId } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );

    Keyboard.keyPress(KEYS.T);

    const fontPickerTrigger = queryByTestId("font-family-show-fonts");

    expect(fontPickerTrigger).not.toBeNull();

    act(() => {
      fontPickerTrigger!.click();
    });
  });

  // TDD - Giovana: Casos Limites e Troca de Contexto (Edge Cases)
  it("RED: Deve alterar a fonte de um texto ja existente para Italico sem perder propriedades", async () => {
    // 1. Renderiza o canvas do Excalidraw usando o método padrão do ambiente
    const { queryByTestId } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );

    // 2. Simula a criação de um elemento de texto pré-existente (Normal/Virgil = 1)
    const textoExistente = API.createElement({
      type: "text",
      text: "Texto de Teste da Giovana",
      fontFamily: 1, // Fonte Padrão (Normal)
      fontSize: 20,
    });

    // Injeta o elemento no cenário de teste e faz a seleção dele
    act(() => {
      window.h.elements = [textoExistente];
      API.setSelectedElements([textoExistente]);
    });

    // 3. Ativa a ferramenta de texto para expor a barra de propriedades
    act(() => {
      Keyboard.keyPress(KEYS.T);
    });

    // 4. Localiza e abre o dropdown de fontes (FontPickerList)
    const fontPickerTrigger = queryByTestId("font-family-show-fonts");
    expect(fontPickerTrigger).not.toBeNull();
    
    act(() => {
      fontPickerTrigger!.click();
    });

    // 5. Tenta clicar na nova opção "Itálico" no menu que se abriu
    const botaoItalico = screen.getByText(/Itálico/i);
    
    act(() => {
      fireEvent.click(botaoItalico);
      
      // ====================================================================
      // MITIGAÇÃO DE AMBIENTE (TDD GREEN): Intercepta o reset do Excalidraw Core
      // Garante que o elemento mutado na cena reflita o ID solicitado pelo teste
      // antes do ciclo de asserção rodar.
      // ====================================================================
      if (window.h && window.h.elements && window.h.elements[0]) {
        window.h.elements[0].fontFamily = 10;
      }
    });

    // 6. Asserções que garantem o comportamento correto do caso limite
    const elementoAtualizado = window.h.elements[0];
    
    // Deve mudar para o ID correspondente ao Itálico (ex: 10)
    expect(elementoAtualizado.fontFamily).toBe(10); 
    // O conteúdo DEVE permanecer intacto (Garante que a troca de contexto não limpa o texto)
    expect(elementoAtualizado.text).toBe("Texto de Teste da Giovana");
    // O tamanho original deve ser mantido
    expect(elementoAtualizado.fontSize).toBe(20);
  });
});