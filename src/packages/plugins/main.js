if (process.env.NODE_ENV === "production") {
  module.exports = require("./dist/excalidraw-plugins.production.min.js");
} else {
  module.exports = require("./dist/excalidraw-plugins.development.js");
}
