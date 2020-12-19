const fs = require("fs");

const THRESSHOLD = 85;

const crowdinMap = {
  "ar-SA": "en-ar",
  "el-GR": "en-el",
  "fi-FI": "en-fi",
  "ja-JP": "en-ja",
  "bg-BG": "en-bg",
  "ca-ES": "en-ca",
  "de-DE": "en-de",
  "es-ES": "en-es",
  "fa-IR": "en-fa",
  "fr-FR": "en-fr",
  "he-IL": "en-he",
  "hi-IN": "en-hi",
  "hu-HU": "en-hu",
  "id-ID": "en-id",
  "it-IT": "en-it",
  "ko-KR": "en-ko",
  "my-MM": "en-my",
  "nb-NO": "en-nb",
  "nl-NL": "en-nl",
  "nn-NO": "en-nnno",
  "pl-PL": "en-pl",
  "pt-PT": "en-pt",
  "ro-RO": "en-ro",
  "ru-RU": "en-ru",
  "sk-SK": "en-sk",
  "sv-SE": "en-sv",
  "tr-TR": "en-tr",
  "uk-UA": "en-uk",
  "zh-CN": "en-zhcn",
  "zh-TW": "en-zhtw",
};

const flags = {
  "ar-SA": "🇸🇦",
  "bg-BG": "🇧🇬",
  "ca-ES": "🇪🇸",
  "de-DE": "🇩🇪",
  "el-GR": "🇬🇷",
  "es-ES": "🇪🇸",
  "fa-IR": "🇮🇷",
  "fi-FI": "🇫🇮",
  "fr-FR": "🇫🇷",
  "he-IL": "🇮🇱",
  "hi-IN": "🇮🇳",
  "hu-HU": "🇭🇺",
  "id-ID": "🇮🇩",
  "it-IT": "🇮🇹",
  "ja-JP": "🇯🇵",
  "ko-KR": "🇰🇷",
  "my-MM": "🇲🇲",
  "nb-NO": "🇳🇴",
  "nl-NL": "🇳🇱",
  "nn-NO": "🇳🇴",
  "pl-PL": "🇵🇱",
  "pt-PT": "🇵🇹",
  "ro-RO": "🇷🇴",
  "ru-RU": "🇷🇺",
  "sk-SK": "🇸🇰",
  "sv-SE": "🇸🇪",
  "tr-TR": "🇹🇷",
  "uk-UA": "🇺🇦",
  "zh-CN": "🇨🇳",
  "zh-TW": "🇹🇼",
};

const languages = {
  "ar-SA": "العربية",
  "bg-BG": "Български",
  "ca-ES": "Catalan",
  "de-DE": "Deutsch",
  "el-GR": "Ελληνικά",
  "es-ES": "Español",
  "fa-IR": "فارسی",
  "fi-FI": "Suomi",
  "fr-FR": "Français",
  "he-IL": "עברית",
  "hi-IN": "हिन्दी",
  "hu-HU": "Magyar",
  "id-ID": "Bahasa Indonesia",
  "it-IT": "Italiano",
  "ja-JP": "日本語",
  "ko-KR": "한국어",
  "my-MM": "Burmese",
  "nb-NO": "Norsk bokmål",
  "nl-NL": "Nederlands",
  "nn-NO": "Norsk nynorsk",
  "pl-PL": "Polski",
  "pt-PT": "Português",
  "ro-RO": "Română",
  "ru-RU": "Русский",
  "sk-SK": "Slovenčina",
  "sv-SE": "Svenska",
  "tr-TR": "Türkçe",
  "uk-UA": "Українська",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
};

const percentages = fs.readFileSync(
  `${__dirname}/../src/locales/percentages.json`,
);
const rowData = JSON.parse(percentages);

const coverages = Object.entries(rowData)
  .sort(([, a], [, b]) => b - a)
  .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});

const printHeader = () => {
  let result = "| | Flag | Locale | % |\n";
  result += "| --: | :--: | -- | --: |";
  return result;
};

const printRow = (id, locale, coverage) => {
  let result = `| ${id} | `;

  result += `${locale in flags ? flags[locale] : ""} | `;
  const language = locale in languages ? languages[locale] : locale;
  if (locale in crowdinMap && crowdinMap[locale]) {
    result += `[${language}](https://crowdin.com/translate/excalidraw/10/${crowdinMap[locale]}) | `;
  } else {
    result += `${language} | `;
  }
  result += `${coverage} |`;
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
  `Our translations for every languages should be at least **${THRESSHOLD}%** to appear on Excalidraw. Join our project in [Crowdin](https://crowdin.com/project/excalidraw) and help us translate it in your language.`,
);
console.info("");
console.info("### Languages over the threshold");
console.info("");
console.info(printHeader());
for (const row of over) {
  console.info(row);
}
console.info("");
console.info("### Languages below the threshold");
console.info("");
console.info(printHeader());
for (const row of under) {
  console.info(row);
}
