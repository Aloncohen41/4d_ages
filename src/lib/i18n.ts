/*
 * The app's languages: English, and Hebrew (right to left). Every word on screen goes through tr(), with the English as the key, so the
 * English stays readable in the code and a missing translation simply shows the English. The words in each other language are in
 * src/locales/. The language is "same as the phone" by default (when there's a translation for it), or chosen in Settings.
 *
 *   tr("Add a measurement")                      → "הוספת מדידה"
 *   tr("{0}'s family", [child.name])             → "המשפחה של מאיה"
 *
 * Lists that are part of the app (foods, milestones, relationships…) are translated when they're shown: see localized().
 */
import { he } from "../locales/he";
import { phoneRegion } from "./region";

export type Lang = "en" | "he";
export type LangChoice = "system" | Lang;

/** The languages there are, each named in itself. */
export const LANGS: { id: Lang; name: string; rtl: boolean }[] = [
  { id: "en", name: "English", rtl: false },
  { id: "he", name: "עברית", rtl: true },
];

const DICTS: Record<Lang, Record<string, string> | null> = { en: null, he };

let current: Lang = "en";

/** The phone's (or browser's) language, when there's a translation for it; otherwise English. */
export function deviceLang(): Lang {
  const code = (phoneRegion().language || "").toLowerCase();
  return code === "he" || code === "iw" ? "he" : "en";
}

/** The language a choice in Settings comes to. */
export const resolveLang = (choice: LangChoice | undefined): Lang => (!choice || choice === "system" ? deviceLang() : choice);

/** Sets the language everything is shown in (the root layout does this, before anything is drawn). */
export function setLang(l: Lang) {
  current = l;
}
export const lang = () => current;
export const isRTL = () => LANGS.find((x) => x.id === current)?.rtl ?? false;

/** The words in the current language: the English (the key) translated, with {0}, {1}… (or {name}) filled in. */
export function tr(english: string, vars?: (string | number | null | undefined)[] | Record<string, string | number | null | undefined>): string {
  const d = DICTS[current];
  const out = (d && d[english]) || english;
  if (!vars) return out;
  return out.replace(/\{(\w+)\}/g, (m, k) => {
    const v = Array.isArray(vars) ? vars[Number(k)] : vars[k];
    return v == null ? "" : String(v);
  });
}

/**
 * A list that's part of the app, with the given text fields shown in the current language whenever they're read (so the lists can stay
 * plain constants, made before the language is known).
 */
export function localized<T extends object>(items: T[], fields: (keyof T)[]): T[] {
  return items.map((item) => {
    const out = { ...item };
    for (const f of fields) {
      const english = item[f];
      if (typeof english !== "string") continue;
      Object.defineProperty(out, f, { get: () => tr(english), enumerable: true, configurable: true });
    }
    return out;
  });
}
