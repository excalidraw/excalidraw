const { readdirSync, writeFileSync } = require("fs");
const files = readdirSync(`${__dirname}/../packages/excalidraw/locales`);

const flatten = (object = {}, result = {}, extraKey = "") => {
  for (const key in object) {
    if (typeof object[key] !== "object") {
      result[extraKey + key] = object[key];
    } else {
      flatten(object[key], result, `${extraKey}${key}.`);
    }
  }
  return result;
};

const locales = files.filter(
  (file) => file !== "README.md" && file !== "percentages.json",
);

const percentages = {};

for (let index = 0; index < locales.length; index++) {
  const currentLocale = locales[index];
  const data = flatten(
    require(`${__dirname}/../packages/excalidraw/locales/${currentLocale}`),
  );

  const allKeys = Object.keys(data);
  const translatedKeys = allKeys.filter((item) => data[item] !== "");
  const percentage = Math.floor((100 * translatedKeys.length) / allKeys.length);
  percentages[currentLocale.replace(".json", "")] = percentage;
}

writeFileSync(
  `${__dirname}/../packages/excalidraw/locales/percentages.json`,
  `${JSON.stringify(percentages, null, 2)}\n`,
  "utf8",
);
