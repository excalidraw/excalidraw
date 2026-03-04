const fs = require("fs");

const THRESHOLD = 85;

// we're using BCP 47 language tags as keys
// e.g. https://gist.github.com/typpo/b2b828a35e683b9bf8db91b5404f1bd1

const crowdinMap = {
  "ar-SA": "en-ar",
  "bg-BG": "en-bg",
  "bn-BD": "en-bn",
  "ca-ES": "en-ca",
  "da-DK": "en-da",
  "de-DE": "en-de",
  "el-GR": "en-el",
  "es-ES": "en-es",
  "eu-ES": "en-eu",
  "fa-IR": "en-fa",
  "fi-FI": "en-fi",
  "fr-FR": "en-fr",
  "gl-ES": "en-gl",
  "he-IL": "en-he",
  "hi-IN": "en-hi",
  "hu-HU": "en-hu",
  "id-ID": "en-id",
  "it-IT": "en-it",
  "ja-JP": "en-ja",
  "kab-KAB": "en-kab",
  "ko-KR": "en-ko",
  "ku-TR": "en-ku",
  "my-MM": "en-my",
  "nb-NO": "en-nb",
  "nl-NL": "en-nl",
  "nn-NO": "en-nnno",
  "oc-FR": "en-oc",
  "pa-IN": "en-pain",
  "pl-PL": "en-pl",
  "pt-BR": "en-ptbr",
  "pt-PT": "en-pt",
  "ro-RO": "en-ro",
  "ru-RU": "en-ru",
  "si-LK": "en-silk",
  "sk-SK": "en-sk",
  "sl-SI": "en-sl",
  "sv-SE": "en-sv",
  "ta-IN": "en-ta",
  "tr-TR": "en-tr",
  "uk-UA": "en-uk",
  "zh-CN": "en-zhcn",
  "zh-HK": "en-zhhk",
  "zh-TW": "en-zhtw",
  "lt-LT": "en-lt",
  "lv-LV": "en-lv",
  "cs-CZ": "en-cs",
  "kk-KZ": "en-kk",
  "vi-VN": "en-vi",
  "mr-IN": "en-mr",
  "th-TH": "en-th",
};

const flags = {
  "ar-SA": "🇸🇦",
  "bg-BG": "🇧🇬",
  "bn-BD": "🇧🇩",
  "ca-ES": "🏳",
  "cs-CZ": "🇨🇿",
  "da-DK": "🇩🇰",
  "de-DE": "🇩🇪",
  "el-GR": "🇬🇷",
  "es-ES": "🇪🇸",
  "fa-IR": "🇮🇷",
  "fi-FI": "🇫🇮",
  "fr-FR": "🇫🇷",
  "gl-ES": "🇪🇸",
  "he-IL": "🇮🇱",
  "hi-IN": "🇮🇳",
  "hu-HU": "🇭🇺",
  "id-ID": "🇮🇩",
  "it-IT": "🇮🇹",
  "ja-JP": "🇯🇵",
  "kab-KAB": "🏳",
  "kk-KZ": "🇰🇿",
  "ko-KR": "🇰🇷",
  "ku-TR": "🏳",
  "lt-LT": "🇱🇹",
  "lv-LV": "🇱🇻",
  "my-MM": "🇲🇲",
  "nb-NO": "🇳🇴",
  "nl-NL": "🇳🇱",
  "nn-NO": "🇳🇴",
  "oc-FR": "🏳",
  "pa-IN": "🇮🇳",
  "pl-PL": "🇵🇱",
  "pt-BR": "🇧🇷",
  "pt-PT": "🇵🇹",
  "ro-RO": "🇷🇴",
  "ru-RU": "🇷🇺",
  "si-LK": "🇱🇰",
  "sk-SK": "🇸🇰",
  "sl-SI": "🇸🇮",
  "sv-SE": "🇸🇪",
  "ta-IN": "🇮🇳",
  "tr-TR": "🇹🇷",
  "uk-UA": "🇺🇦",
  "zh-CN": "🇨🇳",
  "zh-HK": "🇭🇰",
  "zh-TW": "🇹🇼",
  "eu-ES": "🇪🇦",
  "vi-VN": "🇻🇳",
  "mr-IN": "🇮🇳",
  "th-TH": "🇹🇭",
};

const languages = {
  "ar-SA": "العربية",
  "bg-BG": "Български",
  "bn-BD": "Bengali",
  "ca-ES": "Català",
  "cs-CZ": "Česky",
  "da-DK": "Dansk",
  "de-DE": "Deutsch",
  "el-GR": "Ελληνικά",
  "es-ES": "Español",
  "eu-ES": "Euskara",
  "fa-IR": "فارسی",
  "fi-FI": "Suomi",
  "fr-FR": "Français",
  "gl-ES": "Galego",
  "he-IL": "עברית",
  "hi-IN": "हिन्दी",
  "hu-HU": "Magyar",
  "id-ID": "Bahasa Indonesia",
  "it-IT": "Italiano",
  "ja-JP": "日本語",
  "kab-KAB": "Taqbaylit",
  "kk-KZ": "Қазақ тілі",
  "ko-KR": "한국어",
  "ku-TR": "Kurdî",
  "lt-LT": "Lietuvių",
  "lv-LV": "Latviešu",
  "my-MM": "Burmese",
  "nb-NO": "Norsk bokmål",
  "nl-NL": "Nederlands",
  "nn-NO": "Norsk nynorsk",
  "oc-FR": "Occitan",
  "pa-IN": "ਪੰਜਾਬੀ",
  "pl-PL": "Polski",
  "pt-BR": "Português Brasileiro",
  "pt-PT": "Português",
  "ro-RO": "Română",
  "ru-RU": "Русский",
  "si-LK": "සිංහල",
  "sk-SK": "Slovenčina",
  "sl-SI": "Slovenščina",
  "sv-SE": "Svenska",
  "ta-IN": "Tamil",
  "tr-TR": "Türkçe",
  "uk-UA": "Українська",
  "zh-CN": "简体中文",
  "zh-HK": "繁體中文 (香港)",
  "zh-TW": "繁體中文",
  "vi-VN": "Tiếng Việt",
  "mr-IN": "मराठी",
  "th-TH": "ภาษาไทย",
};

const percentages = fs.readFileSync(
  `${__dirname}/../packages/excalidraw/locales/percentages.json`,
);
const rowData = JSON.parse(percentages);

const coverages = Object.entries(rowData)
  .sort(([, a], [, b]) => b - a)
  .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});

const boldIf = (text, condition) => (condition ? `**${text}**` : text);

const printHeader = () => {
  let result = "| | Flag | Locale | % |\n";
  result += "| :--: | :--: | -- | :--: |";
  return result;
};

const printRow = (id, locale, coverage) => {
  const isOver = coverage >= THRESHOLD;
  let result = `| ${isOver ? id : "..."} | `;
  result += `${locale in flags ? flags[locale] : ""} | `;
  const language = locale in languages ? languages[locale] : locale;
  if (locale in crowdinMap && crowdinMap[locale]) {
    result += `[${boldIf(
      language,
      isOver,
    )}](https://crowdin.com/translate/excalidraw/10/${crowdinMap[locale]}) | `;
  } else {
    result += `${boldIf(language, isOver)} | `;
  }
  result += `${coverage === 100 ? "💯" : boldIf(coverage, isOver)} |`;
  return result;
};

console.info(
  `Each language must be at least **${THRESHOLD}%** translated in order to appear on Excalidraw. Join us on [Crowdin](https://crowdin.com/project/excalidraw) and help us translate your own language. **Can't find yours yet?** Open an [issue](https://github.com/excalidraw/excalidraw/issues/new) and we'll add it to the list.`,
);
console.info("\n\r");
console.info(printHeader());
let index = 1;
for (const coverage in coverages) {
  if (coverage === "en") {
    continue;
  }
  console.info(printRow(index, coverage, coverages[coverage]));
  index++;
}
console.info("\n\r");
console.info("\\* Languages in **bold** are going to appear on production.");
