import React from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { resolveGlyph } from "../lib/iconGlyph";

/**
 * Material icons. The screens use these short names; each maps to the Material Design icon of that meaning. Filled variants (`-on`) are for a
 * selected navigation destination, outlined for the rest, as Material 3 does.
 */
const MAP = {
  // actions
  search: "magnify", tag: "tag-outline", "edit-2": "pencil-outline", "trash-2": "delete-outline", x: "close", plus: "plus", check: "check",
  "refresh-cw": "refresh", "chevron-left": "chevron-left", "chevron-right": "chevron-right", "chevron-down": "chevron-down", "chevron-up": "chevron-up",
  film: "movie-outline", play: "play", "arrow-down": "arrow-down", "arrow-up": "arrow-up", "arrow-up-right": "arrow-top-right", calendar: "calendar-blank-outline",
  image: "image-outline", clock: "clock-outline", "user-plus": "account-plus-outline", download: "download", square: "checkbox-blank-outline", "check-square": "checkbox-marked",
  "help-circle": "help-circle-outline", bell: "bell-outline",
  // meanings
  star: "star", heart: "heart", home: "home-outline", smile: "emoticon-happy-outline", "message-circle": "message-outline", zap: "lightbulb-outline", activity: "run",
  // the bottom navigation: outlined, and filled when selected
  "nav-home": "home-outline", "nav-home-on": "home", "nav-milestones": "star-outline", "nav-milestones-on": "star", "nav-growth": "chart-line", "nav-growth-on": "chart-line",
  "nav-family": "account-group-outline", "nav-family-on": "account-group", "nav-book": "book-open-variant", "nav-book-on": "book-open-variant", "nav-add": "plus-circle-outline", "nav-add-on": "plus-circle",
  // the "+" menu
  "add-story": "book-open-page-variant-outline", "add-milestone": "star-outline", "add-measure": "ruler", "add-first": "trophy-outline", "add-last": "flag-checkered", "add-photo": "image-plus",
} as const;
export type IconName = keyof typeof MAP;
export const ICON_GLYPHS: Record<IconName, string> = MAP;

/** The set's list of glyph names, read once (newer versions of the library expose it through getRawGlyphMap()). */
let glyphList: unknown;
let glyphListRead = false;
function glyphs(): unknown {
  if (!glyphListRead) {
    glyphListRead = true;
    try {
      const set = MaterialCommunityIcons as unknown as { getRawGlyphMap?: () => unknown; glyphMap?: unknown };
      glyphList = typeof set.getRawGlyphMap === "function" ? set.getRawGlyphMap() : set.glyphMap;
    } catch {
      glyphList = undefined;
    }
  }
  return glyphList;
}

export function Icon({ name, size = 20, color = "#1d1b1e" }: { name: IconName; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={resolveGlyph(MAP[name], glyphs()) as never} size={size} color={color} />;
}

/** The icon font, loaded once at start so icons never flash empty. */
export const ICON_FONT = MaterialCommunityIcons.font;
