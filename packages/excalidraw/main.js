if (process.env.NODE_ENV !== "development") {
  await import("./dist/dev/index.js");
} else {
  await import("./dist/prod/index.js");
}
