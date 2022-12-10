import { parseClipboard, transformClipboardElementsToText } from "./clipboard";

describe("clipboard", () => {
  describe("parseClipboard", () => {
    it('should return text elements content if "isPlainPaste" is true', async () => {
      const clipboardData = await parseClipboard(
        {
          // @ts-expect-error
          clipboardData: {
            getData: () =>
              JSON.stringify({
                type: "excalidraw/clipboard",
                elements: [{ type: "text", text: "test text 123" }],
              }),
          },
        },
        true,
      );

      expect(clipboardData).toEqual({
        elements: [
          {
            text: "test text 123",
            type: "text",
          },
        ],
        files: undefined,
        text: "test text 123",
      });
    });

    it("should parse valid json correctly", async () => {
      let text = "123";

      let clipboardData = await parseClipboard({
        // @ts-ignore
        clipboardData: {
          getData: () => text,
        },
      });

      expect(clipboardData.text).toBe(text);

      text = "[123]";

      clipboardData = await parseClipboard({
        // @ts-ignore
        clipboardData: {
          getData: () => text,
        },
      });

      expect(clipboardData.text).toBe(text);
    });
  });

  describe("transformClipboardElementsToText", () => {
    it('should return a concatenated string of the text contents when all elements are of type "text"', () => {
      const elements: Parameters<typeof transformClipboardElementsToText>[0] = [
        // @ts-expect-error - we only care about the type and text properties in this test
        {
          type: "text",
          text: "123\n456",
        },
        // @ts-expect-error - we only care about the type and text properties in this test
        {
          type: "text",
          text: "789",
        },
      ];

      const result = transformClipboardElementsToText(elements);

      expect(result).toBe("123\n456\n\n789");
    });
  });
});
