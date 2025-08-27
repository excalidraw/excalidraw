import { randomId, reseed } from "@excalidraw/common";

import type { FileId } from "@excalidraw/element/types";

import * as blobModule from "../data/blob";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { mockMultipleHTMLImageElements } from "./helpers/mocks";
import { render, waitFor } from "./test-utils";
import {
  DEER_IMAGE_DIMENSIONS,
  SMILEY_IMAGE_DIMENSIONS,
} from "./fixtures/constants";

const { h } = window;

const initializedImageProperties = {
  type: "image",
  fileId: expect.any(String),
  x: expect.toBeNonNaNNumber(),
  y: expect.toBeNonNaNNumber(),
};

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
  });

  it("should eventually initialize all dropped images", async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    // it's necessary to specify the height in order to calculate natural dimensions of the image
    h.state.height = 1000;

    mockMultipleHTMLImageElements([
      [DEER_IMAGE_DIMENSIONS.width, DEER_IMAGE_DIMENSIONS.height],
      [SMILEY_IMAGE_DIMENSIONS.width, SMILEY_IMAGE_DIMENSIONS.height],
    ]);

    const files = await Promise.all([
      API.loadFile("./fixtures/deer.png"),
      API.loadFile("./fixtures/smiley.png"),
    ]);
    await API.drop(files);

    await waitFor(() => {
      expect(h.elements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ...initializedImageProperties,
            ...DEER_IMAGE_DIMENSIONS,
          }),
          expect.objectContaining({
            ...initializedImageProperties,
            ...SMILEY_IMAGE_DIMENSIONS,
          }),
        ]),
      );
    });
  });
});
