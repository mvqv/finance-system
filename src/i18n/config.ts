import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import tr from "./locales/tr.json";

const STORAGE_KEY = "atlantix:lang";

// IMPORTANT: i18n must initialize with the SAME language on server and on the
// client's first render to avoid React hydration mismatches. We always start
// with "tr" (the project default) and then apply any persisted choice from
// localStorage inside applyStoredLanguage(), called from a client-only effect
// after mount.
if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        tr: { translation: tr },
      },
      lng: "tr",
      supportedLngs: ["tr", "en"],
      fallbackLng: ["tr", "en"],
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
}

export function applyStoredLanguage() {
  if (typeof window === "undefined") return;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en") {
      if (i18n.language !== "en") i18n.changeLanguage("en");
      return;
    }

    if (i18n.language !== "tr") i18n.changeLanguage("tr");
    if (saved !== "tr") window.localStorage.setItem(STORAGE_KEY, "tr");
  } catch {
    /* ignore */
  }
}

export function changeLanguage(lng: "en" | "tr") {
  i18n.changeLanguage(lng);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, lng);
    } catch {
      /* ignore */
    }
  }
}

export default i18n;
