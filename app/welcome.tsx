import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useStore } from "../src/lib/store";
import { useTheme } from "../src/lib/useTheme";
import { WORDMARKS } from "../src/lib/wordmark";
import { APP_NAME, WORDMARK_ASPECT } from "../src/brand";
import { TYPE } from "../src/theme";
import { isConfigured, signOut, useSession } from "../src/lib/supabase";
import { Btn } from "../src/components/ui";
import { AddChildSheet } from "../src/components/Screen";

/**
 * After signing in, with no child yet: add your little one, or join the book your partner already started. Both only exist here, behind
 * sign-in, so every child belongs to a known account from the start (and is saved to it).
 */
export default function Welcome() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const sync = useStore((s) => s.sync);
  const setShareOpen = useStore((s) => s.setShareOpen);
  const [adding, setAdding] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16, paddingHorizontal: 24 }}>
      <StatusBar style={t.dark ? "light" : "dark"} />
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Image source={WORDMARKS[t.key]} accessibilityLabel={APP_NAME} style={{ width: 280, maxWidth: "100%", aspectRatio: WORDMARK_ASPECT }} contentFit="contain" />
        <Text style={[TYPE.headlineSmall, { color: t.ink, textAlign: "center", marginTop: 16 }]}>Welcome</Text>
        <Text style={[TYPE.bodyLarge, { color: t.ink2, textAlign: "center", marginTop: 6 }]}>Start a book for your little one, or join the one your partner started.</Text>
        {sync.busy ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18 }}>
            <ActivityIndicator color={t.accent} />
            <Text style={[TYPE.bodyMedium, { color: t.ink3 }]}>{sync.progress || "Looking for books already in your account…"}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ gap: 10 }}>
        <Btn label="Add your little one" onPress={() => setAdding(true)} />
        <Btn label="Join a partner's baby book" kind="soft" onPress={() => setShareOpen(true)} />
        {isConfigured && session ? (
          <Pressable onPress={() => signOut()} hitSlop={8} style={{ alignSelf: "center", marginTop: 8 }}>
            <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>Signed in as {session.user.email}. <Text style={{ textDecorationLine: "underline" }}>Sign out</Text></Text>
          </Pressable>
        ) : null}
      </View>
      <AddChildSheet visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}
