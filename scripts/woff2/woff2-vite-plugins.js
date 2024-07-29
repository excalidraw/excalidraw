const OSS_FONTS_CDN =
  "https://excalidraw.nyc3.cdn.digitaloceanspaces.com/fonts/oss/";

/**
 * Custom vite plugin to convert url woff2 imports into a text.
 * Other woff2 imports are automatically served and resolved as a file uri.
 *
 * @returns {import("vite").PluginOption}
 */
module.exports.woff2BrowserPlugin = () => {
  // for now limited to woff2 only, might be extended to any assets in the future
  const regex = /^https:\/\/.+?\.woff2$/;
  let isDev;

  return {
    name: "woff2BrowserPlugin",
    enforce: "pre",
    config(_, { command }) {
      isDev = command === "serve";
    },
    resolveId(source) {
      if (!regex.test(source)) {
        return null;
      }

      // getting the url to the dependency tree
      return source;
    },
    load(id) {
      if (!regex.test(id)) {
        return null;
      }

      // loading the url as string
      return `export default "${id}"`;
    },
    // necessary for dev as vite / rollup does skips https imports in serve (~dev) mode
    // aka dev mode equivalent of "export default x" above (resolveId + load)
    transform(code, id) {
      // treat https woff2 imports as a text
      if (isDev && id.endsWith("/excalidraw/fonts/index.ts")) {
        return code.replaceAll(
          /import\s+(\w+)\s+from\s+(["']https:\/\/.+?\.woff2["'])/g,
          `const $1 = $2`,
        );
      }

      // use CDN for Assistant
      if (id.endsWith("/excalidraw/fonts/assets/fonts.css")) {
        return `/* These also cannot be preprended with \`EXCALIDRAW_ASSET_PATH\`. */
      
      @font-face {
        font-family: "Assistant";
        src: url(${OSS_FONTS_CDN}Assistant-Regular-DVxZuzxb.woff2)
            format("woff2"),
          url(./Assistant-Regular.woff2) format("woff2");
        font-weight: 400;
        style: normal;
        display: swap;
      }
      
      @font-face {
        font-family: "Assistant";
        src: url(${OSS_FONTS_CDN}Assistant-Medium-DrcxCXg3.woff2)
            format("woff2"),
          url(./Assistant-Medium.woff2) format("woff2");
        font-weight: 500;
        style: normal;
        display: swap;
      }
      
      @font-face {
        font-family: "Assistant";
        src: url(${OSS_FONTS_CDN}Assistant-SemiBold-SCI4bEL9.woff2)
            format("woff2"),
          url(./Assistant-SemiBold.woff2) format("woff2");
        font-weight: 600;
        style: normal;
        display: swap;
      }
      
      @font-face {
        font-family: "Assistant";
        src: url(${OSS_FONTS_CDN}Assistant-Bold-gm-uSS1B.woff2)
            format("woff2"),
          url(./Assistant-Bold.woff2) format("woff2");
        font-weight: 700;
        style: normal;
        display: swap;
      }`;
      }

      // using EXCALIDRAW_ASSET_PATH as a SSOT
      if (id.endsWith("excalidraw-app/index.html")) {
        return code.replace(
          "<!-- PLACEHOLDER:EXCALIDRAW_APP_FONTS -->",
          `<% if (typeof PROD != 'undefined' && PROD == true) { %>
      <script>
        // point into our CDN in prod, fallback to root (excalidraw.com) domain in case of issues
        window.EXCALIDRAW_ASSET_PATH = [
          "${OSS_FONTS_CDN}",
          "/",
        ];
      </script>
    <% } else { %>
      <script>
        window.EXCALIDRAW_ASSET_PATH = window.origin;
      </script>
    <% } %>
    
    <!-- Warmup the connection for Google fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

    <!-- Preload all default fonts and Virgil for backwards compatibility to avoid swap on init -->
    <% if (typeof PROD != 'undefined' && PROD == true) { %>
    <link
      rel="preload"
      href="${OSS_FONTS_CDN}Excalifont-Regular-C9eKQy_N.woff2"
      as="font"
      type="font/woff2"
      crossorigin="anonymous"
    />
    <link
      rel="preload"
      href="${OSS_FONTS_CDN}Virgil-Regular-hO16qHwV.woff2"
      as="font"
      type="font/woff2"
      crossorigin="anonymous"
    />
    <link
      rel="preload"
      href="${OSS_FONTS_CDN}ComicShanns-Regular-D0c8wzsC.woff2"
      as="font"
      type="font/woff2"
      crossorigin="anonymous"
    />
    <% } else { %>
    <!-- in DEV we need to preload from the local server and without the hash -->
    <link
      rel="preload"
      href="../packages/excalidraw/fonts/assets/Excalifont-Regular.woff2"
      as="font"
      type="font/woff2"
      crossorigin="anonymous"
    />
    <link
      rel="preload"
      href="../packages/excalidraw/fonts/assets/Virgil-Regular.woff2"
      as="font"
      type="font/woff2"
      crossorigin="anonymous"
    />
    <link
      rel="preload"
      href="../packages/excalidraw/fonts/assets/ComicShanns-Regular.woff2"
      as="font"
      type="font/woff2"
      crossorigin="anonymous"
    />
    <% } %>

    <!-- For Nunito only preload the latin range, which should be enough for now -->
    <link
      rel="preload"
      href="https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2di8HDIkhdTQ3j6zbXWjgeg.woff2"
      as="font"
      type="font/woff2"
      crossorigin="anonymous"
    />

    <!-- Register Assistant as the UI font, before the scene inits -->
    <link
      rel="stylesheet"
      href="../packages/excalidraw/fonts/assets/fonts.css"
      type="text/css"
    />
    `,
        );
      }
    },
  };
};
