/*
 * The emergency number to call for an ambulance, by the phone's country (or, without one, its language), for the pregnancy warnings.
 * Pure, for tests: region.ts reads the phone's settings.
 */

export interface Emergency { number: string; service: string }

const AMBULANCE: Record<string, Emergency> = {
  GB: { number: "999", service: "999" },
  IE: { number: "112", service: "112 or 999" },
  IL: { number: "101", service: "101 (Magen David Adom)" },
  US: { number: "911", service: "911" },
  CA: { number: "911", service: "911" },
  MX: { number: "911", service: "911" },
  AU: { number: "000", service: "000 (Triple Zero)" },
  NZ: { number: "111", service: "111" },
  IN: { number: "112", service: "112 (or 108 for an ambulance)" },
  ZA: { number: "10177", service: "10177 (or 112 from a mobile)" },
  AE: { number: "998", service: "998" },
  SA: { number: "997", service: "997" },
  JP: { number: "119", service: "119" },
  KR: { number: "119", service: "119" },
  CN: { number: "120", service: "120" },
  HK: { number: "999", service: "999" },
  SG: { number: "995", service: "995" },
  PH: { number: "911", service: "911" },
  BR: { number: "192", service: "192 (SAMU)" },
  AR: { number: "107", service: "107" },
  RU: { number: "103", service: "103 (or 112)" },
  UA: { number: "103", service: "103 (or 112)" },
  TR: { number: "112", service: "112" },
  EG: { number: "123", service: "123" },
};
/** Without a country: the country a language is most likely from. */
const BY_LANGUAGE: Record<string, string> = { he: "IL", iw: "IL", ja: "JP", ko: "KR", zh: "CN" };
/** 112 reaches the emergency services from a mobile in the EU and many other countries. */
const DEFAULT: Emergency = { number: "112", service: "your local emergency number (112 works from most mobiles)" };

export function emergencyFor(region?: string | null, language?: string | null): Emergency {
  const country = (region || (language ? BY_LANGUAGE[language.toLowerCase().slice(0, 2)] : "") || "").toUpperCase();
  if (AMBULANCE[country]) return AMBULANCE[country];
  // the rest of Europe: 112
  if (/^(AT|BE|BG|HR|CY|CZ|DK|EE|FI|FR|DE|GR|HU|IT|LV|LT|LU|MT|NL|PL|PT|RO|SK|SI|ES|SE|NO|IS|CH|LI)$/.test(country)) return { number: "112", service: "112" };
  return DEFAULT;
}

/** "call 101 (Magen David Adom)" */
export const callLine = (e: Emergency) => `call ${e.service}`;
