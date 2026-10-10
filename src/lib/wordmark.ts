import type { ImageSourcePropType } from "react-native";
import { KidTheme } from "./types";

/**
 * The in-app logo in each child's colours. The pink one is the original; blue and green are recoloured from it by
 * branding/make-wordmarks.mjs, so all three are the same size (WORDMARK_ASPECT in src/brand.ts).
 */
export const WORDMARKS: Record<KidTheme, ImageSourcePropType> = {
  pink: require("../../assets/4d-ages-wordmark.png"),
  blue: require("../../assets/4d-ages-wordmark-blue.png"),
  green: require("../../assets/4d-ages-wordmark-green.png"),
};
