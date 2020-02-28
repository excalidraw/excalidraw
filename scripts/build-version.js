#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const zero = digit => `0${digit}`.slice(-2);

const versionDate = date => {
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
    app: `excalidraw-${versionDate(now)}.zip`,
    version: versionDate(now),
  },
  undefined,
  2,
);

fs.writeFileSync(path.join("build", "version.json"), data);

const filename = path.join("build", `excalidraw-${versionDate(now)}.zip`);
exec(`jszip-cli add build/* > ${filename}`, (error, stdout, stderr) => {
  if (error) {
    return;
  }
  console.info(`Archive saved in: ${filename}`);
});
