import { defineRouting } from "next-intl/routing";
import config from "./locales.json";

// To add a language: add it to locales.json and add messages/<code>.json.
export const locales = config.locales.map((locale) => locale.code);
export const localeLabels = Object.fromEntries(
  config.locales.map((locale) => [locale.code, locale.label]),
);

export const routing = defineRouting({
  locales,
  defaultLocale: config.defaultLocale,
});
