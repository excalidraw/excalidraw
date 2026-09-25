// src/data/importVisio.ts
import unzipper from "unzipper";
import { parseStringPromise } from "xml2js";

/**
 * Parse a Visio Stencil (.vssx) file and extract basic shape names.
 * For now, we just log them to console as proof of concept.
 */
export async function importVisioStencil(file: File) {
  const buffer = await file.arrayBuffer();
  const directory = await unzipper.Open.buffer(Buffer.from(buffer));

  const masterFiles = directory.files.filter((f) =>
    f.path.startsWith("masters/master")
  );

  console.log("Found", masterFiles.length, "Visio shapes");

  const shapes = [];

  for (const master of masterFiles) {
    const content = await master.buffer();
    const xml = await parseStringPromise(content.toString());
    const name = xml?.Master?.["$"]?.NameU || "Unnamed Shape";
    shapes.push(name);
  }

  console.log("Visio stencil shapes:", shapes);
  alert("Visio stencil loaded! Check console for shapes.");
}
