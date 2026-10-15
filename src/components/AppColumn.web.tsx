import React, { useEffect } from "react";
import { View, useWindowDimensions } from "react-native";
import { usePathname } from "expo-router";
import { useTheme } from "../lib/useTheme";
import { APP_NAME } from "../brand";

/** On a computer, the app sits in a column the width of a large phone, in the middle of the page; on a phone's browser it fills the screen. */
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
  const wide = width > COLUMN + 40;
  return (
    <View style={{ flex: 1, backgroundColor: wide ? t.bg3 : t.bg, alignItems: "center" }}>
      <View role="main" style={{ flex: 1, width: "100%", maxWidth: COLUMN, backgroundColor: t.bg, overflow: "hidden", ...(wide ? { boxShadow: "0 0 32px rgba(0,0,0,.12)" } : {}) }}>
        {children}
      </View>
    </View>
  );
}
