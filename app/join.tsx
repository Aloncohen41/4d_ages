import React, { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTheme } from "../src/lib/useTheme";
import { useStore } from "../src/lib/store";

/**
 * Where a share link lands (fourdages://join?code=…, opened from the link's web page). The code is kept, and the book is added as soon as
 * this phone is signed in: straight away if it already is, or right after signing in or creating an account (see SyncManager).
 */
export default function JoinLink() {
  const t = useTheme();
  const { code } = useLocalSearchParams<{ code?: string }>();
  useEffect(() => {
    const clean = String(code ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length >= 6) useStore.getState().setPendingJoin(clean);
    router.replace("/");
  }, [code]);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", padding: 32 }}>
      <ActivityIndicator color={t.accent} size="large" />
      <Text style={{ color: t.ink2, marginTop: 14, textAlign: "center" }}>Opening the book…</Text>
    </View>
  );
}
