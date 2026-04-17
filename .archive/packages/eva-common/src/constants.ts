export const API_VERSION = "0.1.0";
export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["en", "fr"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
