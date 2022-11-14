import { parseClipboard } from "./clipboard";

describe("Test parseClipboard", () => {
  it("should parse valid json correctly", async () => {
    let text = "123";

    let clipboardData = await parseClipboard({
      //@ts-ignore
      clipboardData: {
        getData: () => text,
      },
    });

    expect(clipboardData.text).toBe(text);

    text = "[123]";

    clipboardData = await parseClipboard({
      //@ts-ignore
      clipboardData: {
        getData: () => text,
      },
    });

    expect(clipboardData.text).toBe(text);
  });
});
