import { API } from "../tests/helpers/api";

import { serializeAsJSON } from "./json";
import {
  decodePngMetadata,
  encodePngMetadata,
  formatFileSize,
  getPngMetadataSize,
} from "./image";

describe("getPngMetadataSize", () => {
  it("equals the number of bytes the embedded scene adds to the PNG", async () => {
    const pngBlob = await API.loadFile("./fixtures/smiley.png");
    const elements = [
      API.createElement({ type: "rectangle", id: "rect" }),
      API.createElement({ type: "ellipse", id: "ellipse", x: 100 }),
    ];
    const metadata = serializeAsJSON(elements, {}, {}, "local");

    const embedded = await encodePngMetadata({ blob: pngBlob, metadata });

    expect(getPngMetadataSize(metadata)).toBe(embedded.size - pngBlob.size);
    // sanity check that the metadata is still readable
    expect(JSON.parse(await decodePngMetadata(embedded)).elements).toHaveLength(
      2,
    );
  });

  it("grows with the size of the scene", () => {
    const small = serializeAsJSON(
      [API.createElement({ type: "rectangle" })],
      {},
      {},
      "local",
    );
    const large = serializeAsJSON(
      Array.from({ length: 50 }, (_, index) =>
        API.createElement({ type: "rectangle", x: index * 10 }),
      ),
      {},
      {},
      "local",
    );
    expect(getPngMetadataSize(large)).toBeGreaterThan(
      getPngMetadataSize(small),
    );
  });
});

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(850)).toBe("850 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1000)).toBe("1 kB");
    expect(formatFileSize(2449)).toBe("2.4 kB");
    expect(formatFileSize(22_400)).toBe("22 kB");
    expect(formatFileSize(999_400)).toBe("999 kB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(1_000_000)).toBe("1 MB");
    expect(formatFileSize(1_340_000)).toBe("1.3 MB");
    expect(formatFileSize(25_600_000)).toBe("26 MB");
  });
});
