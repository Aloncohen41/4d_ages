import React from "react";
import { Linking, Text } from "react-native";
import { useTheme } from "../lib/useTheme";
import { TYPE } from "../theme";
import { ACCESSIBILITY_URL, PRIVACY_URL, TERMS_URL } from "../brand";

/** "Terms · Privacy policy · Accessibility": small links, for the sign-in page and the agreement. */
export function LegalLinks({ center = true, accessibility = true }: { center?: boolean; accessibility?: boolean }) {
  const t = useTheme();
  const link = (label: string, url: string) => (
    <Text accessibilityRole="link" onPress={() => Linking.openURL(url)} style={{ color: t.accentDeep, textDecorationLine: "underline" }}>{label}</Text>
  );
  return (
    <Text style={[TYPE.bodySmall, { color: t.ink3, textAlign: center ? "center" : "left" }]}>
      {link("Terms", TERMS_URL)} · {link("Privacy policy", PRIVACY_URL)}{accessibility ? <> · {link("Accessibility", ACCESSIBILITY_URL)}</> : null}
    </Text>
  );
}
