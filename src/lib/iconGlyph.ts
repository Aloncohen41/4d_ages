/*
 * Picking the glyph to draw. If an icon name were ever missing from the installed icon set, a quiet dot is shown instead of a "?" box.
 * That safety net must never be able to make things worse: it only runs when the set's glyph list is clearly keyed by icon name (it must
 * contain several icons every Material set has). If the list is missing, empty, or shaped differently by some library version, the name is trusted
 * as it is — so a wrong guess about the list can never turn every icon into a dot.
 */
export const SANITY_GLYPHS = ["home", "star", "magnify", "plus", "close", "check"];

/** The glyph list, if (and only if) it can be trusted to be keyed by icon name. */
export function usableGlyphMap(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  return SANITY_GLYPHS.filter((g) => g in m).length >= 4 ? m : null;
}

export function resolveGlyph(glyph: string | undefined, raw: unknown, fallback = "circle-small"): string {
  if (!glyph) return fallback;
  const m = usableGlyphMap(raw);
  return !m || glyph in m ? glyph : fallback;
}
