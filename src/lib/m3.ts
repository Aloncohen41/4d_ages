/*
 * Material 3 colour, in plain TypeScript (no library).
 *
 * Material builds every colour from "tonal palettes": a hue and a chroma, sampled at TONES 0–100, where tone is CIELAB lightness (L*).
 * Roles are then fixed tones from fixed palettes — primary is tone 40, its container tone 90, text on a surface tone 10, and so on — which is
 * what keeps text readable on every background. This reproduces that with CIELAB/LCH maths (D65), reducing chroma where a colour would
 * fall outside what a screen can show.
 */

const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const fromLin = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const WHITE = [0.95047, 1, 1.08883];
const labF = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const labFInv = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);

const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n * 255))).toString(16).padStart(2, "0");
export const rgbToHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

/** CIELAB lightness (0–100) of a colour: this IS the Material "tone". */
export function toneOf(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLin);
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  return 116 * labF(y) - 16;
}

/** The hue (degrees) and chroma of a colour in CIELAB/LCH. */
export function hueChromaOf(hex: string): { hue: number; chroma: number } {
  const [r, g, b] = hexToRgb(hex).map(toLin);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / WHITE[0];
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / WHITE[2];
  const a = 500 * (labF(x) - labF(y)), bb = 200 * (labF(y) - labF(z));
  return { hue: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360, chroma: Math.hypot(a, bb) };
}

function lchToLinear(L: number, C: number, hue: number): [number, number, number] {
  const a = C * Math.cos((hue * Math.PI) / 180), b = C * Math.sin((hue * Math.PI) / 180);
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const x = WHITE[0] * labFInv(fx), y = WHITE[1] * labFInv(fy), z = WHITE[2] * labFInv(fz);
  return [3.2404542 * x - 1.5371385 * y - 0.4985314 * z, -0.969266 * x + 1.8760108 * y + 0.041556 * z, 0.0556434 * x - 0.2040259 * y + 1.0572252 * z];
}
const inGamut = (rgb: number[]) => rgb.every((c) => c >= -0.0004 && c <= 1.0004);

/** A colour at this tone and hue, with as much of the wanted chroma as a screen can show. */
export function colorAt(tone: number, chroma: number, hue: number): string {
  if (tone <= 0) return "#000000";
  if (tone >= 100) return "#ffffff";
  let lo = 0, hi = Math.max(0, chroma);
  if (!inGamut(lchToLinear(tone, hi, hue))) {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(lchToLinear(tone, mid, hue))) lo = mid; else hi = mid;
    }
    hi = lo;
  }
  const [r, g, b] = lchToLinear(tone, hi, hue).map((c) => fromLin(Math.min(1, Math.max(0, c))));
  return rgbToHex(r, g, b);
}

/** WCAG contrast ratio between two colours (≥ 4.5 for normal text, ≥ 3 for large text and icons). */
export function contrast(a: string, b: string): number {
  const lum = (h: string) => { const [r, g, bl] = hexToRgb(h).map(toLin); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The Material 3 colour roles used by the app (light scheme). */
export interface M3Scheme {
  primary: string; onPrimary: string; primaryContainer: string; onPrimaryContainer: string;
  secondary: string; onSecondary: string; secondaryContainer: string; onSecondaryContainer: string;
  tertiary: string; onTertiary: string; tertiaryContainer: string; onTertiaryContainer: string;
  error: string; onError: string; errorContainer: string; onErrorContainer: string;
  surface: string; onSurface: string; onSurfaceVariant: string;
  surfaceContainerLowest: string; surfaceContainerLow: string; surfaceContainer: string; surfaceContainerHigh: string; surfaceContainerHighest: string;
  outline: string; outlineVariant: string;
  inverseSurface: string; inverseOnSurface: string; inversePrimary: string;
  /** a tone of the primary hue, darker than `primary`, for emphasis text on tonal containers */
  primaryDeep: string;
  /** secondary text and hints, between onSurfaceVariant and outline (still ≥ 4.5:1 on every surface) */
  onSurfaceMuted: string;
  onSurfaceSubtle: string;
  /** a hairline softer than outlineVariant, for dividers and quiet borders */
  outlineSoft: string;
}

/**
 * Builds the scheme the way Material's "tonal spot" does: primary / secondary / tertiary / neutral / neutral-variant palettes from the seed's hue,
 * with the standard tone for each role.
 */
export function lightScheme(seed: string): M3Scheme {
  const { hue } = hueChromaOf(seed);
  const P = (t: number) => colorAt(t, 40, hue);
  const S = (t: number) => colorAt(t, 16, hue);
  const T = (t: number) => colorAt(t, 22, hue + 60);
  const N = (t: number) => colorAt(t, 4, hue);
  const NV = (t: number) => colorAt(t, 8, hue);
  const E = (t: number) => colorAt(t, 64, 36); // Material's warm red (≈ #B3261E at tone 40)
  return {
    primary: P(40), onPrimary: P(100), primaryContainer: colorAt(90, 26, hue), onPrimaryContainer: P(10), // the soft container is calmer than the primary (a vivid lime otherwise)
    secondary: S(40), onSecondary: S(100), secondaryContainer: S(90), onSecondaryContainer: S(10),
    tertiary: T(40), onTertiary: T(100), tertiaryContainer: T(90), onTertiaryContainer: T(10),
    error: E(40), onError: E(100), errorContainer: E(90), onErrorContainer: E(10),
    surface: N(98), onSurface: N(10), onSurfaceVariant: NV(30),
    surfaceContainerLowest: N(100), surfaceContainerLow: N(96), surfaceContainer: N(94), surfaceContainerHigh: N(92), surfaceContainerHighest: N(90),
    outline: NV(50), outlineVariant: NV(80),
    inverseSurface: N(20), inverseOnSurface: N(95), inversePrimary: P(80),
    primaryDeep: P(30),
    onSurfaceMuted: NV(38), onSurfaceSubtle: NV(44), outlineSoft: NV(88),
  };
}

/** The colour with an opacity, as 8-digit hex ("#rrggbbaa"): Material's state layers (hover 8%, press 12%) and disabled content (38%) use these. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255).toString(16).padStart(2, "0");
  return `${hex.slice(0, 7)}${a}`;
}
