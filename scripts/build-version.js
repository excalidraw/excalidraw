#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const asar = require("asar");

const zero = (digit) => `0${digit}`.slice(-2);

const versionDate = (date) => {
  const date_ = `${date.getFullYear()}-${zero(date.getMonth() + 1)}-${zero(
    date.getDate(),
  )}`;
  const time = `${zero(date.getHours())}-${zero(date.getMinutes())}-${zero(
    date.getSeconds(),
  )}`;
  return `${date_}-${time}`;
};

const now = new Date();

const data = JSON.stringify(
  {
    asar: `excalidraw.asar`,
    version: versionDate(now),
  },
  undefined,
  2,
);

fs.writeFileSync(path.join("build", "version.json"), data);

(async () => {
  const src = "build/";
  const dest = path.join("build", `excalidraw.asar`);

  await asar.createPackage(src, dest);
})();
