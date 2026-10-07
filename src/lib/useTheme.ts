import { useStore } from "./store";
import { THEMES, Theme } from "../theme";

export function useTheme(): Theme {
  const key = useStore((s) => (s.kids.find((k) => k.id === s.activeId) ?? s.kids[0])?.theme);
  return THEMES[key || "pink"];
}
