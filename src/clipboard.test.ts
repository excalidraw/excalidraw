import { parseClipboard } from "./clipboard";
import { createPasteEvent } from "./tests/test-utils";

describe("Test parseClipboard", () => {
  it("should parse valid json correctly", async () => {
    let text = "123";

    let clipboardData = await parseClipboard(
      createPasteEvent({ "text/plain": text }),
    );

    expect(clipboardData.text).toBe(text);

    text = "[123]";

    clipboardData = await parseClipboard(
      createPasteEvent({ "text/plain": text }),
    );

    expect(clipboardData.text).toBe(text);
  });
});
