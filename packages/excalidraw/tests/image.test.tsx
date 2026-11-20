import {
  MIME_TYPES,
  randomId,
  reseed,
  resolvablePromise,
} from "@excalidraw/common";

import type { FileId } from "@excalidraw/element/types";

import * as blobModule from "../data/blob";
import * as filesystemModule from "../data/filesystem";
import { Excalidraw } from "../index";
import { createPasteEvent } from "../clipboard";

import { API } from "./helpers/api";
import { mockMultipleHTMLImageElements } from "./helpers/mocks";
import { UI } from "./helpers/ui";
import { act, GlobalTestState, render, waitFor } from "./test-utils";
import {
  DEER_IMAGE_DIMENSIONS,
  SMILEY_IMAGE_DIMENSIONS,
} from "./fixtures/constants";
import { INITIALIZED_IMAGE_PROPS } from "./helpers/constants";

import type { ExcalidrawProps } from "../types";

const { h } = window;

export const setupImageTest = async (
  sizes: { width: number; height: number }[],
  props?: ExcalidrawProps,
) => {
  await render(
    <Excalidraw autoFocus={true} handleKeyboardGlobally={true} {...props} />,
  );

  h.state.height = 1000;

  mockMultipleHTMLImageElements(sizes.map((size) => [size.width, size.height]));
};

describe("resizeImageFile", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the original file when it already fits the max dimensions", async () => {
    mockMultipleHTMLImageElements([[100, 100]]);

    const imageFile = new File([new Uint8Array([1, 2, 3])], "image.png", {
      type: MIME_TYPES.png,
    });

    await expect(
      blobModule.resizeImageFile(imageFile, { maxWidthOrHeight: 200 }),
    ).resolves.toBe(imageFile);
  });
});

describe("image insertion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();

    reseed(7);

    const generateIdSpy = vi.spyOn(blobModule, "generateIdFromFile");
    const resizeFileSpy = vi.spyOn(blobModule, "resizeImageFile");

    generateIdSpy.mockImplementation(() =>
      Promise.resolve(randomId() as FileId),
    );
    resizeFileSpy.mockImplementation((file: File) => Promise.resolve(file));

    Object.assign(document, {
      elementFromPoint: () => GlobalTestState.canvas,
    });
  });

  const setup = () =>
    setupImageTest([DEER_IMAGE_DIMENSIONS, SMILEY_IMAGE_DIMENSIONS]);

  const assert = async () => {
    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({
          ...INITIALIZED_IMAGE_PROPS,
          ...DEER_IMAGE_DIMENSIONS,
        }),
        expect.objectContaining({
          ...INITIALIZED_IMAGE_PROPS,
          ...SMILEY_IMAGE_DIMENSIONS,
        }),
      ]);
    });
    // Not placed on top of each other
    const dimensionsSet = new Set(h.elements.map((el) => `${el.x}-${el.y}`));
    expect(dimensionsSet.size).toEqual(h.elements.length);
  };

  it("should eventually initialize all dropped images", async () => {
    await setup();

    const files = await Promise.all([
      API.loadFile("./fixtures/deer.png"),
      API.loadFile("./fixtures/smiley.png"),
    ]);
    await API.drop(files.map((file) => ({ kind: "file", file })));

    await assert();
  });

  it("should eventually initialize all pasted images", async () => {
    await setup();

    document.dispatchEvent(
      createPasteEvent({
        files: await Promise.all([
          API.loadFile("./fixtures/deer.png"),
          API.loadFile("./fixtures/smiley.png"),
        ]),
      }),
    );

    await assert();
  });

  it("should eventually initialize all images added through image tool", async () => {
    await setup();

    const fileOpenSpy = vi.spyOn(filesystemModule, "fileOpen");
    fileOpenSpy.mockImplementation(
      async () =>
        await Promise.all([
          API.loadFile("./fixtures/deer.png"),
          API.loadFile("./fixtures/smiley.png"),
        ]),
    );
    UI.clickExtraTool("image");

    await assert();
  });

  it("passes host-configured max image dimensions to the resize helper", async () => {
    await setupImageTest([DEER_IMAGE_DIMENSIONS], {
      imageOptions: { maxWidthOrHeight: 2048 },
    });

    await API.drop([
      { kind: "file", file: await API.loadFile("./fixtures/deer.png") },
    ]);

    await waitFor(() => {
      expect(blobModule.resizeImageFile).toHaveBeenCalledWith(
        expect.any(File),
        { maxWidthOrHeight: 2048 },
      );
    });
  });

  it("enforces host-configured max image file size", async () => {
    await setupImageTest([DEER_IMAGE_DIMENSIONS], {
      imageOptions: { maxFileSizeBytes: 1024 * 1024 },
    });

    await API.drop([
      {
        kind: "file",
        file: new File([new Uint8Array(2 * 1024 * 1024)], "image.png", {
          type: MIME_TYPES.png,
        }),
      },
    ]);

    await waitFor(() => {
      expect(h.state.errorMessage).toBe(
        "File is too big. Maximum allowed size is 1MB.",
      );
    });
  });

  it("reuses the registered file and decoded image when inserting the same file again", async () => {
    const fileId = "repeated-image" as FileId;
    await setupImageTest([DEER_IMAGE_DIMENSIONS], {
      generateIdForFile: async () => fileId,
    });
    const file = await API.loadFile("./fixtures/deer.png");

    await act(async () => {
      await h.app.insertImages([file], 200, 200);
    });
    const cachedImage = h.app.imageCache.get(fileId);
    expect(cachedImage?.image).toBeDefined();
    const fileData = h.app.files[fileId];

    await act(async () => {
      await h.app.insertImages([file], 500, 200);
    });

    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(2);
    expect(Object.keys(h.app.files)).toEqual([fileId]);
    expect(h.app.files[fileId]).toBe(fileData);
    expect(h.app.imageCache.get(fileId)).toBe(cachedImage);
    expect(blobModule.resizeImageFile).toHaveBeenCalledTimes(1);
    expect(API.getSelectedElements()).toEqual([h.elements[1]]);
  });

  it.each([false, true])(
    "preserves placeholder changes while initialization is pending (deleted: %s)",
    async (isDeleted) => {
      await setupImageTest([DEER_IMAGE_DIMENSIONS]);
      const fileId = resolvablePromise<FileId>();
      vi.mocked(blobModule.generateIdFromFile).mockReturnValueOnce(fileId);
      const file = await API.loadFile("./fixtures/deer.png");
      let insertion!: Promise<void>;
      act(() => {
        insertion = h.app.insertImages([file], 200, 200);
      });
      await waitFor(() =>
        expect(blobModule.generateIdFromFile).toHaveBeenCalledTimes(1),
      );
      const placeholder = h.elements[0];
      expect(placeholder).toMatchObject({ type: "image", fileId: null });

      act(() => {
        API.updateElement(placeholder, { opacity: 35, isDeleted });
      });
      await act(async () => {
        fileId.resolve("pending-image" as FileId);
        await insertion;
      });

      expect(h.elements).toHaveLength(1);
      expect(h.elements[0]).toMatchObject({
        id: placeholder.id,
        fileId: "pending-image",
        opacity: 35,
        isDeleted,
      });
      expect(API.getSelectedElements()).toEqual(
        isDeleted ? [] : [h.elements[0]],
      );
    },
  );

  it("removes failed placeholders while keeping successfully initialized images", async () => {
    await setupImageTest([SMILEY_IMAGE_DIMENSIONS]);
    vi.mocked(blobModule.generateIdFromFile).mockRejectedValueOnce(
      new Error("Cannot read image"),
    );
    const files = await Promise.all([
      API.loadFile("./fixtures/deer.png"),
      API.loadFile("./fixtures/smiley.png"),
    ]);

    await act(async () => {
      await h.app.insertImages(files, 200, 200);
    });

    expect(h.elements).toHaveLength(2);
    expect(h.elements[0].isDeleted).toBe(true);
    expect(h.elements[1]).toMatchObject({
      type: "image",
      isDeleted: false,
      ...SMILEY_IMAGE_DIMENSIONS,
    });
    expect(h.state.errorMessage).toBe("Cannot read image");
    expect(API.getSelectedElements()).toEqual([h.elements[1]]);
  });
});
