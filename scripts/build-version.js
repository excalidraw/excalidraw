#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const now = new Date();

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

const version = {
  version: versionDate(now),
};

const data = JSON.stringify(version);
fs.writeFileSync(path.join("build", "version.json"), data);
