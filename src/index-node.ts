import { exportToCanvas } from "./scene/export";
import { getDefaultAppState } from "./appState";

const { registerFont, createCanvas } = require("canvas");

const elements = [
  {
    angle: 0,
    backgroundColor: "transparent",
    fillStyle: "hachure",
    height: 50,
    id: "id0",
    isDeleted: false,
    opacity: 100,
    roughness: 1,
    seed: 337897,
    strokeColor: "#000000",
    strokeWidth: 1,
    type: "rectangle",
    version: 2,
    versionNonce: 1278240551,
    width: 30,
    x: 30,
    y: 20,
  },
  {
    angle: 0,
    backgroundColor: "transparent",
    fillStyle: "hachure",
    height: 50,
    id: "id0",
    isDeleted: false,
    opacity: 100,
    roughness: 1,
    seed: 337897,
    strokeColor: "#000000",
    strokeWidth: 1,
    type: "rectangle",
    version: 2,
    versionNonce: 1278240551,
    width: 30,
    x: 30,
    y: 20,
  },
  {
    angle: 0,
    backgroundColor: "transparent",
    fillStyle: "hachure",
    height: 390,
    id: "bl6BIEc-nyrSVwx4crUe9",
    isDeleted: false,
    opacity: 100,
    roughness: 1,
    seed: 1150574603,
    strokeColor: "#000000",
    strokeWidth: 1,
    type: "ellipse",
    version: 72,
    versionNonce: 1873935429,
    width: 419,
    x: 191,
    y: -140,
  },
  {
    angle: 0,
    backgroundColor: "transparent",
    baseline: 18,
    fillStyle: "hachure",
    font: "20px Virgil",
    height: 26,
    id: "m8S5PjNP9yom2B3psmlt7",
    isDeleted: false,
    opacity: 100,
    roughness: 1,
    seed: 356085509,
    strokeColor: "#000000",
    strokeWidth: 1,
    text: "Excalidraw!!",
    textAlign: "left",
    type: "text",
    version: 69,
    versionNonce: 2108284357,
    width: 116,
    x: 562,
    y: -291,
  },
];

registerFont("./public/FG_Virgil.ttf", { family: "Virgil" });
registerFont("./public/Cascadia.ttf", { family: "Cascadia" });

const canvas = exportToCanvas(
  elements as any,
  getDefaultAppState(),
  {
    exportBackground: true,
    viewBackgroundColor: "#ffffff",
    shouldAddWatermark: false,
    scale: 1,
  },
  createCanvas,
);

const fs = require("fs");
const out = fs.createWriteStream("test.png");
const stream = canvas.createPNGStream();
stream.pipe(out);
out.on("finish", () => {
  console.info("test.png was created.");
});
