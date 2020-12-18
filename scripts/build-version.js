#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const versionFile = path.join("build", "version.json");
const indexFile = path.join("build", "index.html");

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
    version: versionDate(now),
  },
  undefined,
  2,
);

fs.writeFileSync(versionFile, data);

// https://stackoverflow.com/a/14181136/8418
fs.readFile(indexFile, "utf8", (error, data) => {
  if (error) {
    return console.error(error);
  }
  const result = data.replace(/{version}/g, versionDate(now));

  fs.writeFile(indexFile, result, "utf8", (error) => {
    if (error) {
      return console.error(error);
    }
  });
});
