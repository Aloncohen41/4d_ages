import React, { useState } from "react";
import { onWeb } from "../lib/onWeb";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useTheme } from "../lib/useTheme";
import { WORDMARKS } from "../lib/wordmark";
import { APP_VERSION, TAGLINE, WORDMARK_ASPECT, APP_NAME } from "../brand";
import { isNewer, latestRelease } from "../lib/updateCheck";
import { offer } from "./UpdatePrompt";

import { tr } from "../lib/i18n";
/** The app's branded "About" card: wordmark, version and a line about privacy. */
export function AboutCard() {
  const t = useTheme();
  const [status, setStatus] = useState("");
  const check = async () => {
    setStatus(tr("Checking…"));
    const release = await latestRelease();
    if (!release) return setStatus(tr("Couldn't check. Are you online?"));
    if (!isNewer(release.version, APP_VERSION)) return setStatus(tr("You have the latest version."));
    setStatus("");
    offer(release);
  };
  return (
    <View style={{ backgroundColor: t.card, borderRadius: 22, borderWidth: 1, borderColor: t.line, padding: 20, marginTop: 22, alignItems: "center" }}>
      <Image source={WORDMARKS[t.key]} accessibilityLabel={APP_NAME} alt={APP_NAME} style={{ width: 230, aspectRatio: WORDMARK_ASPECT }} contentFit="contain" />
      <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 13.5, marginTop: 2 }}>{TAGLINE}</Text>
      <Text style={{ color: t.ink4, fontSize: 12, marginTop: 4 }}>{tr("Version {0}", [APP_VERSION])}</Text>
      {!onWeb ? (
        <Pressable onPress={check} hitSlop={8} accessibilityRole="button" style={{ marginTop: 4 }}>
          <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12.5 }}>{status || "Check for updates"}</Text>
        </Pressable>
      ) : null}
      <Text style={{ color: t.ink3, fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 12 }}>
        {tr("Your photos and notes are private to your account and the people you invite. Milestone ages follow ZERO TO THREE's “Developmental Milestones by Age”.")}
      </Text>
    </View>
  );
}
