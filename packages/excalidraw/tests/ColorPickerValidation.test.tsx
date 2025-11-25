import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorPicker } from "../components/ColorPicker/ColorPicker";
import { vi } from "vitest";

// --- MOCKS ---
vi.mock("../editor-jotai", () => ({
  useAtom: () => [null, vi.fn()],
  atom: () => ({}),
}));

vi.mock("../App", () => ({
  useExcalidrawContainer: () => ({ container: document.body }),
  useStylesPanelMode: () => "full",
}));

vi.mock("../EyeDropper", () => ({
  activeEyeDropperAtom: {},
}));

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
// -------------

const mockOnChange = vi.fn();
const mockAppState = {
  openPopup: "elementBackground",
  editingTextElement: null,
} as any;
const mockUpdateData = vi.fn();

describe("ColorPicker UI Feedback", () => {
  it("deve marcar o container como inválido ao digitar hex incorreto", () => {
    // 1. Renderiza
    const { rerender } = render(
      <ColorPicker
        color="#000000"
        onChange={mockOnChange}
        label="Cor"
        type="elementBackground"
        elements={[]}
        appState={mockAppState}
        updateData={mockUpdateData}
      />
    );

    // 2. Encontra o input para digitar (usando placeholder)
    const input = screen.getByPlaceholderText(/hex code|color/i);
    fireEvent.change(input, { target: { value: "#GG" } });

    // 3. Força atualização com valor inválido
    rerender(
      <ColorPicker
        color="#GG"
        onChange={mockOnChange}
        label="Cor"
        type="elementBackground"
        elements={[]}
        appState={mockAppState}
        updateData={mockUpdateData}
      />
    );

    // 4. Verifica se o WRAPPER (div) recebeu o atributo de erro
    const wrapper = screen.getByTestId("hex-input-wrapper");
    expect(wrapper).toHaveAttribute("aria-invalid", "true");
    
    // Opcional: Verifica também se a borda vermelha foi aplicada
    expect(wrapper).toHaveStyle({ border: "2px solid red" });
  });
});