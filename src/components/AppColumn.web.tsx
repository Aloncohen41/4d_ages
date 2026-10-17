import React, { useEffect } from "react";
import { View, useWindowDimensions } from "react-native";
import { usePathname } from "expo-router";
import { useTheme } from "../lib/useTheme";
import { APP_NAME } from "../brand";
import { WIDE } from "../lib/useWide";

/**
 * On a computer the website fills the window, with its own header, wide pages and footer (see SiteHeader). In a browser window narrower
 * than that (a tablet, a narrowed window) the app sits in a column the width of a large phone, in the middle; on a phone it fills the screen.
 */
export const COLUMN = 560;

/** Each screen's name, for the page's title. */
const TITLES: [RegExp, string][] = [
  [/^\/$/, "Home"], [/^\/milestones/, "Milestones"], [/^\/growth/, "Growth"], [/^\/book/, "Book"], [/^\/settings/, "Settings"],
  [/^\/family/, "Family"], [/^\/person\//, "Family member"], [/^\/classics/, "Classics"], [/^\/classic\//, "Classics"], [/^\/health/, "Health"],
  [/^\/pregnancy/, "Pregnancy"], [/^\/access/, "Who can see your memories"], [/^\/share/, "Share"], [/^\/login/, "Sign in"], [/^\/welcome/, "Welcome"],
  [/^\/join/, "Join a book"], [/^\/auth-callback/, "Signing in"],
];

export function AppColumn({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const path = usePathname();
  useEffect(() => {
    const name = TITLES.find(([re]) => re.test(path))?.[1];
    document.title = name ? `${name} · ${APP_NAME}` : APP_NAME;
  }, [path]);
  // the page's own light or dark, for the keyboard focus outline's colour (see public/index.html)
  useEffect(() => { document.documentElement.dataset.theme = t.dark ? "dark" : "light"; }, [t.dark]);
  // the few screens with no header of their own (a welcome, joining a book, signing in) stay a centred block on a computer
  const full = width >= WIDE && !/^\/(welcome|join|auth-callback)/.test(path);
  const wide = width < WIDE && width > COLUMN + 40; // the phone-sized column, set off from the page around it
  return (
    <View style={{ flex: 1, backgroundColor: wide ? t.bg3 : t.bg, alignItems: "center" }}>
      <View role="main" style={{ flex: 1, width: "100%", maxWidth: full ? undefined : COLUMN, backgroundColor: t.bg, overflow: "hidden", ...(wide ? { boxShadow: "0 0 32px rgba(0,0,0,.12)" } : {}) }}>
        {children}
      </View>
    </View>
  );
}
