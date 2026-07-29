/**
 * Chalk texture — post-process that erodes an already-drawn element canvas so
 * strokes/fills look like chalk on a board.
 *
 * Technique (mirrors what we prototyped):
 *   ctx.globalCompositeOperation = "destination-out"
 *   ctx.fillStyle = <noise pattern>; ctx.fillRect(...)
 * `destination-out` keeps the destination only where the source is transparent,
 * i.e. it multiplies the drawn alpha by (1 - noiseAlpha), punching grain holes
 * into the stroke and breaking up its edges.
 *
 * The noise tile is built once and cached, so this is effectively free after the
 * first element render, and because each element is drawn into its own cached
 * offscreen canvas the grain is stable across repaints (no shimmer) and moves
 * with the element (unlike a screen-space CSS filter).
 */

/** master on/off — flip to disable chalk rendering across the fork */
export const CHALK_TEXTURE_ENABLED = true;

/** tile dimensions in device px */
const TILE_SIZE = 256;
/** size of each grain cell in px (larger = coarser, more "chalky" clumps) */
const GRAIN_CELL = 2;
/** fraction of cells that erode (higher = more broken coverage) */
const GRAIN_DENSITY = 0.22;
/** how hard eroded cells bite (higher = more/fuller holes) */
const GRAIN_STRENGTH = 4.0;

let chalkTile: HTMLCanvasElement | null = null;
let chalkTileBuilt = false;

const buildChalkTile = (): HTMLCanvasElement | null => {
  // guard for server-side export environments without a real DOM
  if (typeof document === "undefined") {
    return null;
  }

  const cells = Math.floor(TILE_SIZE / GRAIN_CELL);

  // render low-res noise, then upscale with smoothing off to get blocky grains
  const noise = document.createElement("canvas");
  noise.width = cells;
  noise.height = cells;
  const nctx = noise.getContext("2d");
  if (!nctx) {
    return null;
  }

  const image = nctx.createImageData(cells, cells);
  const data = image.data;
  const threshold = 1 - GRAIN_DENSITY;

  for (let i = 0; i < cells * cells; i++) {
    const r = Math.random();
    const erosion = r > threshold ? Math.min(1, (r - threshold) * GRAIN_STRENGTH) : 0;
    // color is irrelevant for destination-out; only alpha matters
    data[i * 4 + 3] = Math.round(erosion * 255);
  }
  nctx.putImageData(image, 0, 0);

  const tile = document.createElement("canvas");
  tile.width = TILE_SIZE;
  tile.height = TILE_SIZE;
  const tctx = tile.getContext("2d");
  if (!tctx) {
    return null;
  }
  tctx.imageSmoothingEnabled = false;
  tctx.drawImage(noise, 0, 0, cells, cells, 0, 0, TILE_SIZE, TILE_SIZE);

  return tile;
};

const getChalkTile = (): HTMLCanvasElement | null => {
  if (!chalkTileBuilt) {
    chalkTile = buildChalkTile();
    chalkTileBuilt = true;
  }
  return chalkTile;
};

/**
 * Erode the pixels currently drawn on `context` (an element's offscreen canvas)
 * to give them a chalk texture. `width`/`height` are the canvas dimensions in
 * device pixels. Must be called after the element has been drawn.
 */
export const applyChalkTexture = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  /**
   * 0..1 multiplier on how much grain bites. Text uses a lower value so small
   * glyph strokes don't erode away; shapes use the full amount.
   */
  intensity: number = 1,
): void => {
  if (!CHALK_TEXTURE_ENABLED || intensity <= 0) {
    return;
  }

  const tile = getChalkTile();
  if (!tile) {
    return;
  }

  const pattern = context.createPattern(tile, "repeat");
  if (!pattern) {
    return;
  }

  context.save();
  // work in raw device pixels regardless of any element transform in effect
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalCompositeOperation = "destination-out";
  context.globalAlpha = Math.min(1, intensity);
  context.fillStyle = pattern;
  context.fillRect(0, 0, width, height);
  context.restore();
};
