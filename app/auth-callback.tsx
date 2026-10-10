import React, { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router } from "expo-router";
import { useTheme } from "../src/lib/useTheme";
import { useSession } from "../src/lib/supabase";
import { useAuthLinkError } from "../src/lib/authLinkState";

/**
 * Where the verification email's button lands. The sign-in in the link is completed by the root layout; this page only shows that it is
 * happening, then moves on: into the app once signed in, or back to the login page (which explains the problem) if the link didn't work.
 */
export default function AuthCallback() {
  const t = useTheme();
  const session = useSession();
  const error = useAuthLinkError((s) => s.error);
  useEffect(() => {
    if (session || error) {
      router.replace("/");
      return;
    }
    const id = setTimeout(() => router.replace("/"), 8000); // never left on this page
    return () => clearTimeout(id);
  }, [session, error]);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", padding: 32 }}>
      <ActivityIndicator color={t.accent} size="large" />
      <Text style={{ color: t.ink2, marginTop: 14, textAlign: "center" }}>Signing you in…</Text>
    </View>
  );
}
