const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const which = require("which");
const fetch = require("node-fetch");
const wawoff = require("wawoff2");
const { Font } = require("fonteditor-core");

/**
 * Custom esbuild plugin to convert url woff2 imports into a text.
 * Other woff2 imports are handled by a "file" loader.
 *
 * @returns {import("esbuild").Plugin}
 */
module.exports.woff2BrowserPlugin = () => {
  return {
    name: "woff2BrowserPlugin",
    setup(build) {
      build.initialOptions.loader = {
        ".woff2": "file",
        ...build.initialOptions.loader,
      };

      build.onResolve({ filter: /^https:\/\/.+?\.woff2$/ }, (args) => {
        return {
          path: args.path,
          namespace: "woff2BrowserPlugin",
        };
      });

      build.onLoad(
        { filter: /.*/, namespace: "woff2BrowserPlugin" },
        async (args) => {
          return {
            contents: args.path,
            loader: "text",
          };
        },
      );
    },
  };
};

/**
 * Custom esbuild plugin to:
 * 1. inline all woff2 (url and relative imports) as base64 for server-side use cases (no need for additional font fetch; works in both esm and commonjs)
 * 2. convert all the imported fonts (including those from cdn) at build time into .ttf (since Resvg does not support woff2, neither inlined dataurls - https://github.com/RazrFalcon/resvg/issues/541)
 *    - merging multiple woff2 into one ttf (for same families with different unicode ranges)
 *    - deduplicating glyphs due to the merge process
 *    - merging emoji font for each
 *    - printing out font metrics
 *
 * @returns {import("esbuild").Plugin}
 */
module.exports.woff2ServerPlugin = (options = {}) => {
  // google CDN fails time to time, so let's retry
  async function fetchRetry(url, options = {}, retries = 0, delay = 1000) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`Status: ${response.status}, ${await response.json()}`);
      }

      return response;
    } catch (e) {
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchRetry(url, options, retries - 1, delay * 2);
      }

      console.error(`Couldn't fetch: ${url}, error: ${e.message}`);
      throw e;
    }
  }

  return {
    name: "woff2ServerPlugin",
    setup(build) {
      const { outdir, generateTtf } = options;
      const outputDir = path.resolve(outdir);
      const fonts = new Map();

      build.onResolve({ filter: /\.woff2$/ }, (args) => {
        const resolvedPath = args.path.startsWith("http")
          ? args.path // url
          : path.resolve(args.resolveDir, args.path); // absolute path

        return {
          path: resolvedPath,
          namespace: "woff2ServerPlugin",
        };
      });

      build.onLoad(
        { filter: /.*/, namespace: "woff2ServerPlugin" },
        async (args) => {
          let woff2Buffer;

          if (path.isAbsolute(args.path)) {
            // read local woff2 as a buffer (WARN: `readFileSync` does not work!)
            woff2Buffer = await fs.promises.readFile(args.path);
          } else {
            // fetch remote woff2 as a buffer (i.e. from a cdn)
            const response = await fetchRetry(args.path, {}, 3);
            woff2Buffer = await response.buffer();
          }

          // google's brotli decompression into snft
          const snftBuffer = new Uint8Array(
            await wawoff.decompress(woff2Buffer),
          ).buffer;

          // load font and store per fontfamily & subfamily cache
          let font;

          try {
            font = Font.create(snftBuffer, {
              type: "ttf",
              hinting: true,
              kerning: true,
            });
          } catch {
            // if loading as ttf fails, try to load as otf
            font = Font.create(snftBuffer, {
              type: "otf",
              hinting: true,
              kerning: true,
            });
          }

          const fontFamily = font.data.name.fontFamily;
          const subFamily = font.data.name.fontSubFamily;

          if (!fonts.get(fontFamily)) {
            fonts.set(fontFamily, {});
          }

          if (!fonts.get(fontFamily)[subFamily]) {
            fonts.get(fontFamily)[subFamily] = [];
          }

          // store the snftbuffer per subfamily
          fonts.get(fontFamily)[subFamily].push(font);

          // inline the woff2 as base64 for server-side use cases
          // NOTE: "file" loader is broken in commonjs and "dataurl" loader does not produce correct ur
          return {
            contents: `data:font/woff2;base64,${woff2Buffer.toString(
              "base64",
            )}`,
            loader: "text",
          };
        },
      );

      // TODO: strip away some unnecessary glyphs
      build.onEnd(async () => {
        if (!generateTtf) {
          return;
        }

        const isFontToolsInstalled = await which("fonttools", {
          nothrow: true,
        });
        if (!isFontToolsInstalled) {
          console.error(
            `Skipped TTF generation: install "fonttools" first in order to generate TTF fonts!\nhttps://github.com/fonttools/fonttools`,
          );
          return;
        }

        const sortedFonts = Array.from(fonts.entries()).sort(
          ([family1], [family2]) => (family1 > family2 ? 1 : -1),
        );

        // for now we are interested in the regular families only
        for (const [family, { Regular }] of sortedFonts) {
          const baseFont = Regular[0];

          const tempFilePaths = Regular.map((_, index) =>
            path.resolve(outputDir, `temp_${family}_${index}.ttf`),
          );

          for (const [index, font] of Regular.entries()) {
            // tempFileNames
            if (!fs.existsSync(outputDir)) {
              fs.mkdirSync(outputDir, { recursive: true });
            }

            // write down the buffer
            fs.writeFileSync(tempFilePaths[index], font.write({ type: "ttf" }));
          }

          const emojiFilePath = path.resolve(
            __dirname,
            "./assets/NotoEmoji-Regular.ttf",
          );

          const emojiBuffer = fs.readFileSync(emojiFilePath);
          const emojiFont = Font.create(emojiBuffer, { type: "ttf" });

          // hack so that:
          // - emoji font has same metrics as the base font, otherwise pyftmerge throws due to different unitsPerEm
          // - emoji font glyphs are adjusted based to the base font glyphs, otherwise the glyphs don't match
          const patchedEmojiFont = Font.create({
            ...baseFont.data,
            glyf: baseFont.find({ unicode: [65] }), // adjust based on the "A" glyph (does not have to be first)
          }).merge(emojiFont, { adjustGlyf: true });

          const emojiTempFilePath = path.resolve(
            outputDir,
            `temp_${family}_Emoji.ttf`,
          );
          fs.writeFileSync(
            emojiTempFilePath,
            patchedEmojiFont.write({ type: "ttf" }),
          );

          const mergedFontPath = path.resolve(outputDir, `${family}.ttf`);

          execSync(
            `pyftmerge --output-file="${mergedFontPath}" "${tempFilePaths.join(
              '" "',
            )}" "${emojiTempFilePath}"`,
          );

          // cleanup
          fs.rmSync(emojiTempFilePath);
          for (const path of tempFilePaths) {
            fs.rmSync(path);
          }

          // yeah, we need to read the font again (:
          const mergedFont = Font.create(fs.readFileSync(mergedFontPath), {
            type: "ttf",
            kerning: true,
            hinting: true,
          });

          // keep copyright & licence per both fonts, as per the OFL licence
          mergedFont.set({
            ...mergedFont.data,
            name: {
              ...mergedFont.data.name,
              copyright: `${baseFont.data.name.copyright} & ${emojiFont.data.name.copyright}`,
              licence: `${baseFont.data.name.licence} & ${emojiFont.data.name.licence}`,
            },
          });

          fs.rmSync(mergedFontPath);
          fs.writeFileSync(mergedFontPath, mergedFont.write({ type: "ttf" }));

          const { ascent, descent } = baseFont.data.hhea;
          console.info(`Generated "${family}"`);
          if (Regular.length > 1) {
            console.info(
              `- by merging ${Regular.length} woff2 files and 1 emoji ttf file`,
            );
          }
          console.info(
            `- with metrics ${baseFont.data.head.unitsPerEm}, ${ascent}, ${descent}`,
          );
          console.info(``);
        }
      });
    },
  };
};
