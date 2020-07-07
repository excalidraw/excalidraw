const { readdirSync, writeFileSync } = require("fs");
const files = readdirSync(`${__dirname}/../src/locales`);

const flatten = (object) =>
  Object.keys(object).reduce(
    (initial, current) => ({ ...initial, ...object[current] }),
    {},
  );

const locales = files.filter(
  (file) => file !== "README.md" && file !== "percentages.json",
);

const percentages = {};

for (let index = 0; index < locales.length; index++) {
  const currentLocale = locales[index];
  const data = flatten(require(`${__dirname}/../src/locales/${currentLocale}`));

  const allKeys = Object.keys(data);
  const translatedKeys = allKeys.filter((item) => data[item] !== "");

  const percentage = (100 * translatedKeys.length) / allKeys.length;

  percentages[currentLocale.replace(".json", "")] = parseInt(percentage);
}

writeFileSync(
  `${__dirname}/../src/locales/percentages.json`,
  `${JSON.stringify(percentages, null, 2)}\n`,
  "utf8",
);
