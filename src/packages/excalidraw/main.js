if (process.env.IS_PREACT === "true") {
  if (process.env.NODE_ENV === "production") {
    module.exports = require("./dist/excalidraw-with-preact.production.min.js");
  } else {
    module.exports = require("./dist/excalidraw-with-preact.development.js");
  }
} else if (process.env.NODE_ENV === "production") {
  module.exports = require("./dist/excalidraw.production.min.js");
} else {
  module.exports = require("./dist/excalidraw.development.js");
}
