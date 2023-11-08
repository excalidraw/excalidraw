console.log(window.IS_PREACT, "PREACT");
if (window.IS_PREACT) {
  module.exports = require("./dist/excalidraw-with-preact.production.min.js");
} else if (process.env.NODE_ENV === "production") {
  module.exports = require("./dist/excalidraw.production.min.js");
} else {
  module.exports = require("./dist/excalidraw.development.js");
}
