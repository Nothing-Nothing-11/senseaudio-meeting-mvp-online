export const TRANSLATION_TARGET_LANGUAGES = Object.freeze([
  { value: "zh", nativeLabel: "中文" },
  { value: "en", nativeLabel: "English" },
  { value: "ja", nativeLabel: "日本語" },
  { value: "ko", nativeLabel: "한국어" },
  { value: "ru", nativeLabel: "Русский" },
  { value: "es", nativeLabel: "Español" },
  { value: "fr", nativeLabel: "Français" },
  { value: "de", nativeLabel: "Deutsch" },
  { value: "pt", nativeLabel: "Português" },
  { value: "ar", nativeLabel: "العربية" },
  { value: "vi", nativeLabel: "Tiếng Việt" },
]);

export const MAIN_READING_LANGUAGES = Object.freeze(["zh", "en", "ja"]);

export const LANGUAGE_LABELS = Object.freeze({
  zh: { zh: "中文", ja: "中国語", en: "Chinese" },
  en: { zh: "英文", ja: "英語", en: "English" },
  ja: { zh: "日文", ja: "日本語", en: "Japanese" },
  jp: { zh: "日文", ja: "日本語", en: "Japanese" },
  ko: { zh: "韩文", ja: "韓国語", en: "Korean" },
  ru: { zh: "俄文", ja: "ロシア語", en: "Russian" },
  es: { zh: "西班牙文", ja: "スペイン語", en: "Spanish" },
  fr: { zh: "法文", ja: "フランス語", en: "French" },
  de: { zh: "德文", ja: "ドイツ語", en: "German" },
  pt: { zh: "葡萄牙文", ja: "ポルトガル語", en: "Portuguese" },
  ar: { zh: "阿拉伯文", ja: "アラビア語", en: "Arabic" },
  vi: { zh: "越南文", ja: "ベトナム語", en: "Vietnamese" },
  auto: { zh: "自动判定", ja: "自動判定", en: "Auto-detect" },
  none: { zh: "关闭", ja: "オフ", en: "Off" },
  unknown: { zh: "未知语言", ja: "不明な言語", en: "Unknown" },
});

const TARGET_LANGUAGE_CODES = Object.freeze(
  TRANSLATION_TARGET_LANGUAGES.map((item) => item.value)
);

export function isSupportedTargetLanguage(code) {
  return TARGET_LANGUAGE_CODES.includes(String(code || "").trim().toLowerCase());
}

export function isSupportedMainLanguage(code) {
  return MAIN_READING_LANGUAGES.includes(String(code || "").trim().toLowerCase());
}

export function renderTargetLanguageOptions(selectNode, selectedValue = "en") {
  if (!selectNode) {
    return;
  }

  selectNode.innerHTML = TRANSLATION_TARGET_LANGUAGES.map(
    ({ value, nativeLabel }) => `<option value="${value}">${nativeLabel}</option>`
  ).join("");

  selectNode.value = isSupportedTargetLanguage(selectedValue) ? selectedValue : "en";
}
