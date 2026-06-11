import { isAnim } from "../src/anim";
import fs from "fs";
import path from "path";

const testResourcesDir = path.resolve(__dirname, "anim_test_res");

const readFileAsBlob = (filePath: string, type?: string): Blob => {
  const buffer = fs.readFileSync(filePath);
  return new Blob([new Uint8Array(buffer)], type ? { type } : undefined);
};

describe("isAnim", () => {
  it("should detect animated GIF", async () => {
    const blob = readFileAsBlob(
      path.join(testResourcesDir, "example.gif"),
      "image/gif",
    );
    expect(await isAnim(blob)).toBe(true);
  });

  it("should detect animated PNG (APNG)", async () => {
    const blob = readFileAsBlob(
      path.join(testResourcesDir, "example.png"),
      "image/png",
    );
    expect(await isAnim(blob)).toBe(true);
  });

  it("should detect animated WebP", async () => {
    const blob = readFileAsBlob(
      path.join(testResourcesDir, "example.webp"),
      "image/webp",
    );
    expect(await isAnim(blob)).toBe(true);
  });

  it("should detect static PNG", async () => {
    const blob = readFileAsBlob(
      path.join(testResourcesDir, "false_example.png"),
      "image/png",
    );
    expect(await isAnim(blob)).toBe(false);
  });

  it("should detect static WebP", async () => {
    const blob = readFileAsBlob(
      path.join(testResourcesDir, "false_example.webp"),
      "image/webp",
    );
    expect(await isAnim(blob)).toBe(false);
  });
});
