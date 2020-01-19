import { getExportCanvasPreview } from "../src/scene/getExportCanvasPreview";

const { registerFont, createCanvas } = require("canvas");

const elements = [
  {
    id: "eVzaxG3YnHhqjEmD7NdYo",
    type: "diamond",
    x: 519,
    y: 199,
    width: 113,
    height: 115,
    strokeColor: "#000000",
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 1,
    roughness: 1,
    opacity: 100,
    isSelected: false,
    seed: 749612521
  },
  {
    id: "7W-iw5pEBPTU3eaCaLtFo",
    type: "ellipse",
    x: 552,
    y: 238,
    width: 49,
    height: 44,
    strokeColor: "#000000",
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 1,
    roughness: 1,
    opacity: 100,
    isSelected: false,
    seed: 952056308
  },
  {
    id: "kqKI231mvTrcsYo2DkUsR",
    type: "text",
    x: 557.5,
    y: 317.5,
    width: 43,
    height: 31,
    strokeColor: "#000000",
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 1,
    roughness: 1,
    opacity: 100,
    isSelected: false,
    seed: 1683771448,
    text: "test",
    font: "20px Virgil",
    baseline: 22
  }
];

registerFont("./public/FG_Virgil.ttf", { family: "Virgil" });
const canvas = getExportCanvasPreview(
  elements as any,
  {
    exportBackground: true,
    viewBackgroundColor: "#ffffff",
    scale: 1
  },
  createCanvas
);

const fs = require("fs");
const out = fs.createWriteStream("test.png");
const stream = canvas.createPNGStream();
stream.pipe(out);
out.on("finish", () => console.log("test.png was created."));
