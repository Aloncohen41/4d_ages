import React from "react";
import { View, useWindowDimensions } from "react-native";
import { useTheme } from "../lib/useTheme";

/** On a computer, the app sits in a column the width of a large phone, in the middle of the page; on a phone's browser it fills the screen. */
export const COLUMN = 560;

export function AppColumn({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const wide = width > COLUMN + 40;
  return (
    <View style={{ flex: 1, backgroundColor: wide ? t.bg3 : t.bg, alignItems: "center" }}>
      <View style={{ flex: 1, width: "100%", maxWidth: COLUMN, backgroundColor: t.bg, overflow: "hidden", ...(wide ? { boxShadow: "0 0 32px rgba(0,0,0,.12)" } : {}) }}>
        {children}
      </View>
    </View>
  );
}
