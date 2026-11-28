import { getFileHandleType, isImageFileHandle } from "./blob";

const fileHandle = (name: string) => ({ name } as FileSystemFileHandle);

describe("getFileHandleType", () => {
  it.each([
    ["scene.excalidraw", "excalidraw"],
    ["scene.json", "json"],
    ["scene.png", "png"],
    ["scene.svg", "svg"],
    ["scene.EXCALIDRAW", "excalidraw"],
    ["scene.PNG", "png"],
    ["scene.excalidraw.PNG", "png"],
    ["scene.Svg", "svg"],
    ["scene.txt", null],
    ["scene.pngx", null],
  ])("should return the type of %s as %s", (name, type) => {
    expect(getFileHandleType(fileHandle(name))).toBe(type);
  });

  it("should treat uppercase image extensions as image file handles", () => {
    expect(isImageFileHandle(fileHandle("scene.PNG"))).toBe(true);
    expect(isImageFileHandle(fileHandle("scene.SVG"))).toBe(true);
    expect(isImageFileHandle(fileHandle("scene.JSON"))).toBe(false);
  });
});
