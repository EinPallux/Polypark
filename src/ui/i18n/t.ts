import { en, type TranslationKey } from "./en";

/**
 * The i18n seam (TECHNICAL_ARCHITECTURE §13): every user-facing string flows
 * through here from day one so later locales are a data change. Params use
 * {name} placeholders.
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const template = en[key];
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export type { TranslationKey };
