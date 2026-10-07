import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { SPLASH_BG, SPLASH_ICON_WIDTH } from "../brand";

/**
 * Shown while the app is getting ready. It reproduces the splash screen exactly — same cream, same icon, same size and
 * position — so the hand-over from the splash is invisible. (The in-app logo already contains the icon, so it isn't repeated here.)
 */
export function BrandScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: SPLASH_BG, alignItems: "center", justifyContent: "center" }}>
      <Image source={require("../../assets/splash-icon.png")} style={{ width: SPLASH_ICON_WIDTH, height: SPLASH_ICON_WIDTH }} contentFit="contain" />
    </View>
  );
}
