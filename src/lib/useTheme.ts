import { useColorScheme } from "react-native";
import { useStore } from "./store";
import { THEMES, THEMES_DARK, Theme } from "../theme";

/** The active child's colour theme, light or dark as the phone is set. */
export function useTheme(): Theme {
  const key = useStore((s) => (s.kids.find((k) => k.id === s.activeId) ?? s.kids[0])?.theme);
  const dark = useColorScheme() === "dark";
  return (dark ? THEMES_DARK : THEMES)[key || "pink"];
}
