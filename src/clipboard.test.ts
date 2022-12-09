import * as clipboard from "./clipboard";
import {
  type ElementsClipboard,
  parseClipboard,
  transformClipboardElementsToText,
} from "./clipboard";

// @ts-expect-error - we need this in order for the tests not to fail on document.execCommand not being defined
jest.spyOn(clipboard, "copyTextViaExecCommand").mockResolvedValue(true);

describe("parseClipboard", () => {
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

describe("copyToClipboard", () => {
  const copyTextToSystemClipboard = jest
    .spyOn(clipboard, "copyTextToSystemClipboard")
    .mockResolvedValue();
  const transformClipboardElementsToText = jest
    .spyOn(clipboard, "transformClipboardElementsToText")
    .mockReturnValue("123");

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("should call transformClipboardElementsToText with correct arguments", async () => {
    const elements: Parameters<typeof clipboard["copyToClipboard"]>[0] = [
      {
        id: "1",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        angle: 0,
        strokeColor: "#000000",
        backgroundColor: "#ffffff",
        fillStyle: "hachure",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        seed: 0,
        groupIds: [],
        roundness: null,
        version: 0,
        isDeleted: false,
        versionNonce: 0,
        boundElements: [],
        updated: 0,
        link: null,
        locked: false,
      },
    ];
    // @ts-expect-error - we don't really need to pass an app state here to test this
    const appState: Parameters<typeof clipboard["copyToClipboard"]>[1] = {};
    const files: Parameters<typeof clipboard["copyToClipboard"]>[2] = null;

    const input: Parameters<typeof clipboard["copyToClipboard"]> = [
      elements,
      appState,
      files,
    ];

    await clipboard.copyToClipboard(...input);

    expect(transformClipboardElementsToText).toHaveBeenCalledWith(
      expect.any(String),
    );
  });

  it("should copy elements as text to clipboard", async () => {
    const elements: Parameters<typeof clipboard["copyToClipboard"]>[0] = [
      {
        id: "1",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        angle: 0,
        strokeColor: "#000000",
        backgroundColor: "#ffffff",
        fillStyle: "hachure",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        seed: 0,
        groupIds: [],
        roundness: null,
        version: 0,
        isDeleted: false,
        versionNonce: 0,
        boundElements: [],
        updated: 0,
        link: null,
        locked: false,
      },
    ];
    // @ts-expect-error - we don't really need to pass an app state here to test this
    const appState: Parameters<typeof clipboard["copyToClipboard"]>[1] = {};
    const files: Parameters<typeof clipboard["copyToClipboard"]>[2] = null;

    const input: Parameters<typeof clipboard["copyToClipboard"]> = [
      elements,
      appState,
      files,
    ];

    await clipboard.copyToClipboard(...input);

    expect(copyTextToSystemClipboard).toHaveBeenCalledWith(expect.any(String));
  });

  it("should log an error if copyTextToSystemClipboard throws", async () => {
    const error = new Error("some-error");
    copyTextToSystemClipboard.mockRejectedValue(error);

    const consoleError = jest.spyOn(console, "error").mockImplementation();

    // @ts-expect-error - we're testing the error case
    await clipboard.copyToClipboard({ elements: [] });

    expect(consoleError).toHaveBeenNthCalledWith(2, error);
  });
});

describe("transformClipboardElementsToText", () => {
  it('should return a concatenated string of the text contents when all elements are of type "text"', () => {
    const clipboardData: ElementsClipboard = {
      elements: [
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
      ],
    };

    const result = transformClipboardElementsToText(clipboardData);

    expect(result).toBe("123\n456\n789");
  });
});
