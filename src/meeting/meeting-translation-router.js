import { getSystemLanguage } from "../i18n/locale-store.js";
import { LANGUAGE_LABELS } from "../i18n/translation-languages.js?v=20260709-langs";

// 非拉丁字形与语种一一对应，命中即可判定；拉丁字族无法靠字符集区分，不在此处理。
function detectByScript(text) {
  if (/[가-힯ᄀ-ᇿ㄰-㆏]/.test(text)) {
    return "ko";
  }

  if (/[Ѐ-ӿ]/.test(text)) {
    return "ru";
  }

  if (/[؀-ۿݐ-ݿ]/.test(text)) {
    return "ar";
  }

  return "";
}

export function detectLanguage(text) {
  const input = (text || "").trim();
  if (!input) {
    return "unknown";
  }

  const normalizedForDetection = stripPunctuationForDetection(input);
  if (normalizedForDetection.length === 1) {
    const singleCharScript = detectByScript(normalizedForDetection);
    if (singleCharScript) {
      return singleCharScript;
    }

    if (/[\u3040-\u30ff]/.test(normalizedForDetection)) {
      return "ja";
    }

    if (/[\u4e00-\u9fff]/.test(normalizedForDetection)) {
      return "zh";
    }

    return "unknown";
  }

  if (input.length <= 1) {
    return "unknown";
  }

  const scriptLanguage = detectByScript(input);
  if (scriptLanguage) {
    return scriptLanguage;
  }

  const hasJapaneseKana = /[\u3040-\u30ff]/.test(input);
  const hasJapanesePattern = /(です|ます|でした|ください|ません|でしたか|しましょう)/.test(input);
  if (hasJapaneseKana || hasJapanesePattern) {
    return "ja";
  }

  const cjkMatches = input.match(/[\u4e00-\u9fff]/g) ?? [];
  const latinMatches = input.match(/[A-Za-z]/g) ?? [];
  const latinWords = input.match(/[A-Za-z]+/g) ?? [];
  const digitMatches = input.match(/[0-9]/g) ?? [];
  const kanaMatches = input.match(/[\u3040-\u30ff]/g) ?? [];
  const meaningfulCount =
    cjkMatches.length + latinMatches.length + kanaMatches.length + digitMatches.length;

  if (meaningfulCount <= 1) {
    return "unknown";
  }

  const latinRatio = meaningfulCount === 0 ? 0 : latinMatches.length / meaningfulCount;
  if (latinRatio >= 0.95 && latinWords.length >= 2) {
    return "en";
  }

  if (cjkMatches.length > 0) {
    return "zh";
  }

  if (latinRatio >= 0.95) {
    return "en";
  }

  return "unknown";
}

export function createTranslationPlan({ sourceLanguage, meetingTargetLanguage }) {
  const normalizedSource = sourceLanguage || "unknown";
  const normalizedTarget = meetingTargetLanguage || "en";

  if (normalizedTarget === "none") {
    return {
      sourceLanguage: normalizedSource,
      desiredTargetLanguage: "none",
      shouldTranslate: false,
      routeDescription: getLanguageLabel("none"),
    };
  }

  // 规则判别失败时不猜测语种，交给翻译模型自行判断源语言。
  // 若模型判定源语言已等于目标语言，会原样返回，不会产生改写。
  if (normalizedSource === "unknown") {
    return {
      sourceLanguage: "auto",
      desiredTargetLanguage: normalizedTarget,
      shouldTranslate: true,
      routeDescription: `${getLanguageLabel("auto")} -> ${getLanguageLabel(normalizedTarget)}`,
    };
  }

  return {
    sourceLanguage: normalizedSource,
    desiredTargetLanguage: normalizedTarget,
    shouldTranslate: normalizedSource !== normalizedTarget,
    routeDescription: `${getLanguageLabel(normalizedSource)}原文 -> ${getLanguageLabel(normalizedTarget)}`,
  };
}

export function createPolicySummary({ mainLanguage, meetingTargetLanguage, translatorModel }) {
  const language = getSystemLanguage();
  if (language === "ja") {
    return `主表示言語は ${getLanguageLabel(
      mainLanguage
    )}。発言はソース言語を問わず ${getLanguageLabel(
      meetingTargetLanguage
    )} に翻訳されます（同一言語の場合は翻訳しません）。現在の正式フローは "DeepThink 音声転写 + ルール判定 + ルーティング翻訳" で、翻訳モデルは ${
      translatorModel || "senseaudio-s2-lite"
    } です。`;
  }
  if (language === "en") {
    return `Primary reading language is ${getLanguageLabel(
      mainLanguage
    )}. Speech in any source language is translated into ${getLanguageLabel(
      meetingTargetLanguage
    )} (skipped when already in that language). The current production chain is "DeepThink transcription + rule routing + translation", using ${
      translatorModel || "senseaudio-s2-lite"
    } as the translation model.`;
  }
  return `主阅读语言 ${getLanguageLabel(
    mainLanguage
  )}；发言无论源语种一律译为 ${getLanguageLabel(
    meetingTargetLanguage
  )}（源语种相同时不翻译）。当前正式链路为“DeepThink 原文转写 + 规则判别 + 路由翻译”，译文执行模型为 ${
    translatorModel || "senseaudio-s2-lite"
  }。`;
}

export function getLanguageLabel(code) {
  const language = getSystemLanguage();
  return LANGUAGE_LABELS[code || "unknown"]?.[language] ?? code ?? LANGUAGE_LABELS.unknown[language];
}

function stripPunctuationForDetection(text) {
  return String(text || "").replace(/[。！？!?，、,.．…·:：;；"'“”‘’（）()【】\[\]<>《》「」『』\-—_～~`/\\|]+/g, "");
}
