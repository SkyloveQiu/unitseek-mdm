import { en } from "./en";

export type TranslationKey = keyof typeof en;
export type Translations = typeof en;

export const translations: Record<string, Translations> = {
  en,
};

export const supportedLanguages = [
  { code: "en", label: "English" },
] as const;

export type LanguageCode = (typeof supportedLanguages)[number]["code"];
