import { useWindowDimensions } from "react-native";

/** How wide a browser window has to be for the website's computer layout (see useWide.web.ts). On a phone, never. */
export const WIDE = 960;
export const useWide = () => false;
/** The width a page is laid out in. On a phone, the screen's. */
export const useScreenWidth = (_inner?: number) => useWindowDimensions().width;
