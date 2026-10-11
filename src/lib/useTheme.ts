import { useColorScheme } from "react-native";
import { useStore } from "./store";
import { THEMES, THEMES_DARK, Theme } from "../theme";

/** The active child's colour theme, light or dark: as the phone is set, unless Settings says always light or always dark. */
export function useTheme(): Theme {
  const key = useStore((s) => (s.kids.find((k) => k.id === s.activeId) ?? s.kids[0])?.theme);
  const appearance = useStore((s) => s.appearance);
  const phone = useColorScheme();
  const dark = appearance === "system" ? phone === "dark" : appearance === "dark";
  return (dark ? THEMES_DARK : THEMES)[key || "pink"];
}
