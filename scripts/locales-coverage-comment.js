const fs = require("fs");

const THRESSHOLD = 85;

const crowdinMap = {
  "ar-SA": "en-ar",
  "el-GR": "en-el",
  "fi-FI": "en-fi",
};

const flags = {
  "el-GR": "🇬🇷",
};

const percentages = fs.readFileSync(
  `${__dirname}/../src/locales/percentages.json`,
);
const rowData = JSON.parse(percentages);

const coverages = Object.entries(rowData)
  .sort(([, a], [, b]) => b - a)
  .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});

const printRow = (id, locale, coverage) => {
  let result = `| ${id} | `;
  if (locale in flags) {
    result += flags[locale];
  }
  if (locale in crowdinMap) {
    result += `[${locale}](https://crowdin.com/translate/excalidraw/10/${crowdinMap[locale]}) | `;
  } else {
    result += `${locale} | `;
  }
  result += `${coverage} |`;
  return result;
};

const printTableHeader = () => {
  let result = "| | Locale | % |\n";
  result += "| --: | -- | --: |";
  return result;
};

let passId = 1;
let notPassId = 1;
const over = [];
const under = [];

for (const coverage in coverages) {
  if (coverage === "en") {
    continue;
  }
  const per = coverages[coverage];

  if (per > THRESSHOLD) {
    over.push(printRow(passId, coverage, per));
    passId++;
  } else {
    under.push(printRow(notPassId, coverage, per));
    notPassId++;
  }
}

console.info("## Languages check");
console.info("");
console.info(
  `Our translations for every languages should be at least **${THRESSHOLD}%** to appear on Excalidraw. Help us translate them in [Crowdin](https://crowdin.com/project/excalidraw).`,
);
console.info("");
console.info("### Languages over the threshold");
console.info("");
console.info(printTableHeader());
for (const row of over) {
  console.info(row);
}
console.info("");
console.info("### Languages below the threshold");
console.info("");
console.info(printTableHeader());
for (const row of under) {
  console.info(row);
}
