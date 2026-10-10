import type { TextStyle } from "react-native";
import { KidTheme } from "./lib/types";
import { colorAt, darkScheme, hueChromaOf, lightScheme } from "./lib/m3";

/**
 * The app's colours are Material 3 roles, generated from each child's colour (see lib/m3.ts). The names screens already use are kept and now
 * mean the Material role they stand for:
 *   bg → surface · bg2 → surface container · bg3 → surface container highest · card → surface container low · line → a soft outline
 *   accent → primary · accentSoft → primary container · accentDeep → primary, one step darker
 *   ink → on-surface · ink2 → on-surface-variant · ink3 / ink4 → quieter text that still reads clearly · danger → error
 * and the roles the restyled components use directly are added below.
 *
 * Every child theme comes in a light and a dark version (THEMES and THEMES_DARK); the app follows the phone's dark-mode setting.
 */
export interface Theme {
  key: KidTheme;
  label: string;
  dark: boolean;
  swatch: [string, string];
  bg: string;
  bg2: string;
  bg3: string;
  card: string;
  line: string;
  accent: string;
  accentSoft: string;
  accentDeep: string;
  ink: string;
  ink2: string;
  ink3: string;
  ink4: string;
  gold: string;
  goldSoft: string;
  goldInk: string; // text on `gold` (the milestone badge)
  danger: string;
  dangerSoft: string;
  // Material 3 roles used directly
  onAccent: string; // text and icons on `accent` (on-primary)
  onAccentSoft: string; // on `accentSoft` (on-primary-container)
  chipOn: string; // a selected chip / segment / tab indicator (secondary container)
  onChipOn: string; // text and icons on `chipOn`
  surfaceHigh: string; // dialogs, menus, raised containers (surface container high)
  outline: string; // text-field borders and outlined buttons
  onDanger: string;
  inverse: string; // snackbars and tooltips (inverse surface)
  onInverse: string;
  scrim: string; // the dim behind a sheet
  // tags, the same hues for every child
  eventInk: string; // event-tag label on goldSoft
  place: string; // place-tag ground
  placeInk: string; // place-tag label on place
}

const SEEDS: Record<KidTheme, { label: string; seed: string }> = {
  pink: { label: "Light pink", seed: "#d16a92" },
  blue: { label: "Light blue", seed: "#5f8fc2" },
  green: { label: "Light green", seed: "#67a058" },
};

const GOLD = "#d9a83f";
const PLACE = "#436b33";

function build(key: KidTheme, dark = false): Theme {
  const { label, seed } = SEEDS[key];
  const m = dark ? darkScheme(seed) : lightScheme(seed);
  const gold = hueChromaOf(GOLD).hue, place = hueChromaOf(PLACE).hue;
  return {
    key, label, dark, swatch: [m.primaryContainer, m.primary],
    bg: m.surface, bg2: m.surfaceContainer, bg3: m.surfaceContainerHighest, card: m.surfaceContainerLow, line: m.outlineSoft,
    accent: m.primary, accentSoft: m.primaryContainer, accentDeep: m.primaryDeep,
    ink: m.onSurface, ink2: m.onSurfaceVariant, ink3: m.onSurfaceMuted, ink4: m.onSurfaceSubtle,
    gold: GOLD, goldInk: "#2c1f15", goldSoft: dark ? colorAt(24, 18, gold) : "#f8ecd0", danger: m.error, dangerSoft: m.errorContainer,
    onAccent: m.onPrimary, onAccentSoft: m.onPrimaryContainer, chipOn: m.secondaryContainer, onChipOn: m.onSecondaryContainer,
    surfaceHigh: m.surfaceContainerHigh, outline: m.outline, onDanger: m.onError, inverse: m.inverseSurface, onInverse: m.inverseOnSurface,
    scrim: dark ? "#00000099" : "#00000052", // Material's scrim: black at 32% (60% in the dark, where 32% barely shows)
    eventInk: dark ? colorAt(84, 40, gold) : "#8a6414",
    place: dark ? colorAt(24, 16, place) : "#e4efdc",
    placeInk: dark ? colorAt(84, 30, place) : PLACE,
  };
}

export const THEMES: Record<KidTheme, Theme> = { pink: build("pink"), blue: build("blue"), green: build("green") };
export const THEMES_DARK: Record<KidTheme, Theme> = { pink: build("pink", true), blue: build("blue", true), green: build("green", true) };
export const THEME_ORDER: KidTheme[] = ["pink", "blue", "green"];

/** The expressive display face, used sparingly (the login tagline). Loaded in app/_layout.tsx; Android falls back to its serif if it fails. */
export const DISPLAY_FONT = "Fraunces_600SemiBold_Italic";

/**
 * Material 3's type scale, on the phone's own font (Roboto on Android). Weights are Material's: 400 for reading text, 500 for titles and labels.
 * Use as `style={[TYPE.titleMedium, { color: t.ink }]}`.
 */
export const TYPE = {
  displaySmall: { fontSize: 36, lineHeight: 44, fontWeight: "400" },
  headlineLarge: { fontSize: 32, lineHeight: 40, fontWeight: "400" },
  headlineMedium: { fontSize: 28, lineHeight: 36, fontWeight: "400" },
  headlineSmall: { fontSize: 24, lineHeight: 32, fontWeight: "400" },
  titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: "400" },
  titleMedium: { fontSize: 16, lineHeight: 24, fontWeight: "500", letterSpacing: 0.15 },
  titleSmall: { fontSize: 14, lineHeight: 20, fontWeight: "500", letterSpacing: 0.1 },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: "400", letterSpacing: 0.5 },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: "400", letterSpacing: 0.25 },
  bodySmall: { fontSize: 12, lineHeight: 16, fontWeight: "400", letterSpacing: 0.4 },
  labelLarge: { fontSize: 14, lineHeight: 20, fontWeight: "500", letterSpacing: 0.1 },
  labelMedium: { fontSize: 12, lineHeight: 16, fontWeight: "500", letterSpacing: 0.5 },
  labelSmall: { fontSize: 11, lineHeight: 16, fontWeight: "500", letterSpacing: 0.5 },
} as const satisfies Record<string, TextStyle>;
