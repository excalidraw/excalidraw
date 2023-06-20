if (import.meta.env.PROD) {
  module.exports = require("./dist/excalidraw.production.min.js");
} else {
  module.exports = require("./dist/excalidraw.development.js");
}
