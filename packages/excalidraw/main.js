if (process.env.NODE_ENV !== "development") {
  import("./dist/dev/index.js");
} else {
  import("./dist/prod/index.js");
}
