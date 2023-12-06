if ((process && process.env.IS_PREACT === "true") || import.meta.env.IS_PREACT === "true") {
  if (process.env.NODE_ENV === "production" || import.meta.env.MODE === "production") {
    module.exports = require("./dist/excalidraw-with-preact.production.min.js");
  } else {
    module.exports = require("./dist/excalidraw-with-preact.development.js");
  }
} else if ((process && process.env.NODE_ENV === "production") || import.meta.env.MODE === "production") {
  module.exports = require("./dist/excalidraw.production.min.js");
} else {
  module.exports = require("./dist/excalidraw.development.js");
}