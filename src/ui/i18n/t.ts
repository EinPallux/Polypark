import { en, type TranslationKey } from "./en";

/**
 * The i18n seam (TECHNICAL_ARCHITECTURE §13): every user-facing string flows
 * through here from day one so later locales are a data change. Params use
 * {name} placeholders.
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  // why: keys built from content ids (`goal.${id}`) reach here through a cast,
  // so a missing entry is a runtime hole the compiler can't see. Echo the key
  // instead of rendering blank — a gap should be loud. i18n.test.ts is the net.
  const template: string | undefined = en[key];
  if (template === undefined) {
    return key;
  }
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * "1 month" / "3 months" as a phrase to slot into a `{duration}` placeholder.
 * English-only for now (DECISIONS Q-03); a locale with richer plural rules
 * replaces this function, not every call site.
 */
export function months(n: number): string {
  return t(n === 1 ? "time.month.one" : "time.month.many", { n });
}

export type { TranslationKey };
