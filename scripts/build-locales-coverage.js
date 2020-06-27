const { readdirSync, writeFileSync } = require("fs");
const files = readdirSync(`${__dirname}/../src/locales`);

const flatten = (object) =>
  Object.keys(object).reduce(
    (initial, current) => ({ ...initial, ...object[current] }),
    {},
  );

const locales = files.filter(
  (file) =>
    file !== "README.md" &&
    file !== "build-percentages.js" &&
    file !== "en.json" &&
    file !== "percentages.json",
);

const percentages = {
  en: 100,
};

for (let i = 0; i < locales.length; i++) {
  const data = flatten(require(`${__dirname}/../src/locales/${locales[i]}`));

  const allKeys = Object.keys(data);
  const translatedKeys = allKeys.filter((item) => data[item] !== "");

  const percentage = (100 * translatedKeys.length) / allKeys.length;

  percentages[locales[i].replace(".json", "")] = parseInt(percentage);
}

writeFileSync(
  `${__dirname}/../src/locales/percentages.json`,
  JSON.stringify(percentages),
  "utf8",
);
