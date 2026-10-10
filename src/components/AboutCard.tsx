import React from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { useTheme } from "../lib/useTheme";
import { WORDMARKS } from "../lib/wordmark";
import { APP_VERSION, TAGLINE, WORDMARK_ASPECT } from "../brand";

/** The app's branded "About" card: wordmark, version and a line about privacy. */
export function AboutCard() {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.card, borderRadius: 22, borderWidth: 1, borderColor: t.line, padding: 20, marginTop: 22, alignItems: "center" }}>
      <Image source={WORDMARKS[t.key]} style={{ width: 230, aspectRatio: WORDMARK_ASPECT }} contentFit="contain" />
      <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 13.5, marginTop: 2 }}>{TAGLINE}</Text>
      <Text style={{ color: t.ink4, fontSize: 12, marginTop: 4 }}>Version {APP_VERSION}</Text>
      <Text style={{ color: t.ink3, fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 12 }}>
        Your photos and notes stay on this phone unless you choose to share them. Milestone ages follow ZERO TO THREE's “Developmental Milestones by Age”.
      </Text>
    </View>
  );
}
