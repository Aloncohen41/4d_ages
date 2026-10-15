import { useWindowDimensions } from "react-native";

/** How wide a browser window has to be for the website's computer layout: a header with links, wide pages, centred pop-ups. */
export const WIDE = 960;
export function useWide(): boolean {
  return useWindowDimensions().width >= WIDE;
}

/**
 * The width a page is laid out in, for things sized from it (the book's pages, a grid of photos): on a phone the screen's; in a narrower
 * browser window the app's column (see AppColumn); on a computer the page's content area, whose inside is at most `inner` wide. Like the
 * screen's width, it includes the 16 px a page keeps on each side.
 */
export function useScreenWidth(inner = 856): number {
  const { width } = useWindowDimensions();
  if (width >= WIDE) return Math.min(width - 64, inner) + 32;
  return width > 600 ? Math.min(width, 560) : width;
}
