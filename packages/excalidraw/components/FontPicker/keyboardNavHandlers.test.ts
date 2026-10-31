import { KEYS } from "@excalidraw/common";

import { fontPickerKeyHandler } from "./keyboardNavHandlers";

const event = {
  key: KEYS.ENTER,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
} as React.KeyboardEvent<HTMLDivElement>;

const createProps = () => ({
  event,
  inputRef: { current: null },
  hoveredFont: undefined,
  filteredFonts: [],
  onClose: vi.fn(),
  onSelect: vi.fn(),
  onHover: vi.fn(),
  onResolve: vi.fn(),
});

describe("fontPickerKeyHandler", () => {
  it("resolves the search term when Enter is pressed without a result", () => {
    const props = createProps();

    expect(fontPickerKeyHandler(props)).toBe(true);
    expect(props.onResolve).toHaveBeenCalledTimes(1);
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it("selects the hovered font instead of resolving the search term", () => {
    const props = {
      ...createProps(),
      hoveredFont: {
        value: "provider:Font",
      } as unknown as Parameters<typeof fontPickerKeyHandler>[0]["hoveredFont"],
    };

    expect(fontPickerKeyHandler(props)).toBe(true);
    expect(props.onSelect).toHaveBeenCalledWith("provider:Font");
    expect(props.onResolve).not.toHaveBeenCalled();
  });
});
