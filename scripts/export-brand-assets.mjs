#!/usr/bin/env node
/**
 * Export optimized TFDraw brand assets from docs/branding/ masters into public/.
 *
 * Usage: yarn export:brand-assets
 */
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const BRANDING_DIR = path.join(REPO_ROOT, "docs/branding");
const PUBLIC_DIR = path.join(REPO_ROOT, "public");
const BRAND_DIR = path.join(PUBLIC_DIR, "brand");

const HERO_BG = "#0b1210";
const OG_TAGLINE = "Terraform as a living architecture diagram";

const SIZE_LIMITS = {
  "tfdraw-logo.png": 80 * 1024,
  "og-image.png": 300 * 1024,
};

const pngOptions = { compressionLevel: 9, palette: true, effort: 10 };

/** @param {string} filePath */
async function fileBytes(filePath) {
  const { size } = await stat(filePath);
  return size;
}

/** @param {string} label @param {string} filePath */
async function logFile(label, filePath) {
  const bytes = await fileBytes(filePath);
  const kb = (bytes / 1024).toFixed(1);
  console.log(`  ${label}: ${kb} KB`);
  return bytes;
}

/**
 * @param {import('sharp').Sharp} image
 * @param {number} size
 */
async function writeSquarePng(image, size, outPath) {
  await image
    .clone()
    .resize(size, size, { fit: "cover", position: "centre" })
    .png(pngOptions)
    .toFile(outPath);
}

/**
 * Maskable icon: mark centered with ~10% safe-zone padding on square canvas.
 * @param {import('sharp').Sharp} image
 * @param {number} size
 */
async function writeMaskablePng(image, size, outPath) {
  const inset = Math.round(size * 0.1);
  const inner = size - inset * 2;
  const mark = await image
    .clone()
    .resize(inner, inner, { fit: "contain", background: HERO_BG })
    .png(pngOptions)
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: HERO_BG,
    },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .png(pngOptions)
    .toFile(outPath);
}

/** @param {string} masterPath @param {number} maxWidth */
async function writeCompressedWebp(masterPath, outPath, maxWidth) {
  await sharp(masterPath)
    .resize(maxWidth, null, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85, effort: 6 })
    .toFile(outPath);
}

/** @param {string} masterPath @param {number} maxSize */
async function writeCompressedPng(masterPath, outPath, maxSize) {
  await sharp(masterPath)
    .resize(maxSize, maxSize, { fit: "inside", withoutEnlargement: true })
    .png(pngOptions)
    .toFile(outPath);
}

async function writeOgImage(horizontalLogoPath, outPath) {
  const width = 1200;
  const height = 630;
  const logoMaxWidth = Math.round(width * 0.6);

  const logo = await sharp(horizontalLogoPath)
    .resize(logoMaxWidth, null, { fit: "inside", withoutEnlargement: true })
    .png(pngOptions)
    .toBuffer();

  const logoMeta = await sharp(logo).metadata();
  const logoWidth = logoMeta.width ?? logoMaxWidth;
  const logoHeight = logoMeta.height ?? 120;
  const logoLeft = Math.round((width - logoWidth) / 2);
  const logoTop = Math.round(height * 0.32 - logoHeight / 2);

  const taglineSvg = Buffer.from(
    `<svg width="${width}" height="120" xmlns="http://www.w3.org/2000/svg">
      <text
        x="50%"
        y="50%"
        dominant-baseline="middle"
        text-anchor="middle"
        fill="#eef5f1"
        font-family="system-ui, -apple-system, Segoe UI, sans-serif"
        font-size="34"
        font-weight="500"
        letter-spacing="0.01em"
      >${OG_TAGLINE}</text>
    </svg>`,
  );

  const taglineTop = logoTop + logoHeight + 36;

  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: HERO_BG,
    },
  })
    .composite([
      { input: logo, left: logoLeft, top: logoTop },
      { input: taglineSvg, left: 0, top: taglineTop },
    ])
    .png(pngOptions)
    .toFile(outPath);
}

async function main() {
  const markMaster = path.join(BRANDING_DIR, "tfdraw-mark-on-black.png");
  const markWhiteMaster = path.join(BRANDING_DIR, "tfdraw-mark-on-white.png");
  const horizontalMaster = path.join(
    BRANDING_DIR,
    "tfdraw-logo-horizontal-on-black.png",
  );
  const wordmarkBlackMaster = path.join(
    BRANDING_DIR,
    "tfdraw-wordmark-on-black.png",
  );
  const wordmarkWhiteMaster = path.join(
    BRANDING_DIR,
    "tfdraw-wordmark-on-white.png",
  );

  await mkdir(BRAND_DIR, { recursive: true });

  const mark = sharp(markMaster);

  console.log("Exporting favicon and PWA icons from tfdraw-mark-on-black.png…");
  await writeSquarePng(mark, 16, path.join(PUBLIC_DIR, "favicon-16x16.png"));
  await writeSquarePng(mark, 32, path.join(PUBLIC_DIR, "favicon-32x32.png"));
  await writeSquarePng(mark, 180, path.join(PUBLIC_DIR, "apple-touch-icon.png"));
  await writeSquarePng(
    mark,
    192,
    path.join(PUBLIC_DIR, "android-chrome-192x192.png"),
  );
  await writeSquarePng(
    mark,
    512,
    path.join(PUBLIC_DIR, "android-chrome-512x512.png"),
  );
  await writeSquarePng(mark, 512, path.join(PUBLIC_DIR, "tfdraw-logo.png"));
  await writeMaskablePng(mark, 192, path.join(PUBLIC_DIR, "maskable_icon_x192.png"));
  await writeMaskablePng(mark, 512, path.join(PUBLIC_DIR, "maskable_icon_x512.png"));

  console.log("Exporting branded OG card…");
  await writeOgImage(horizontalMaster, path.join(PUBLIC_DIR, "og-image.png"));

  console.log("Exporting public/brand/ extras…");
  await writeCompressedPng(
    markWhiteMaster,
    path.join(BRAND_DIR, "tfdraw-mark-on-white.png"),
    512,
  );
  await writeCompressedPng(
    markMaster,
    path.join(BRAND_DIR, "tfdraw-mark-on-black.png"),
    512,
  );
  await writeCompressedWebp(
    horizontalMaster,
    path.join(BRAND_DIR, "tfdraw-logo-horizontal-on-black.webp"),
    1200,
  );
  await writeCompressedWebp(
    wordmarkBlackMaster,
    path.join(BRAND_DIR, "tfdraw-wordmark-on-black.webp"),
    800,
  );
  await writeCompressedWebp(
    wordmarkWhiteMaster,
    path.join(BRAND_DIR, "tfdraw-wordmark-on-white.webp"),
    800,
  );

  console.log("\nProduction asset sizes:");
  const outputs = [
    ["favicon-16x16.png", path.join(PUBLIC_DIR, "favicon-16x16.png")],
    ["favicon-32x32.png", path.join(PUBLIC_DIR, "favicon-32x32.png")],
    ["apple-touch-icon.png", path.join(PUBLIC_DIR, "apple-touch-icon.png")],
    [
      "android-chrome-192x192.png",
      path.join(PUBLIC_DIR, "android-chrome-192x192.png"),
    ],
    [
      "android-chrome-512x512.png",
      path.join(PUBLIC_DIR, "android-chrome-512x512.png"),
    ],
    ["tfdraw-logo.png", path.join(PUBLIC_DIR, "tfdraw-logo.png")],
    ["og-image.png", path.join(PUBLIC_DIR, "og-image.png")],
    [
      "maskable_icon_x192.png",
      path.join(PUBLIC_DIR, "maskable_icon_x192.png"),
    ],
    [
      "maskable_icon_x512.png",
      path.join(PUBLIC_DIR, "maskable_icon_x512.png"),
    ],
  ];

  let failed = false;
  for (const [name, filePath] of outputs) {
    const bytes = await logFile(name, filePath);
    const limit = SIZE_LIMITS[name];
    if (limit && bytes > limit) {
      console.error(
        `  ERROR: ${name} is ${bytes} bytes (limit ${limit} bytes)`,
      );
      failed = true;
    }
  }

  if (failed) {
    process.exit(1);
  }

  console.log("\nDone. Commit public/ outputs; docs/branding/ masters stay as source.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
