if (process.env.NODE_ENV === "development") {
  //zsviczian
  module.exports = require("./dist/excalidraw.development.js");
  //import("./dist/dev/index.js"); //zsviczian
} else {
  module.exports = require("./dist/excalidraw.production.min.js");
  //import("./dist/prod/index.js"); //zsviczian
}
