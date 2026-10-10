import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "../lib/useTheme";
import { withAlpha } from "../lib/m3";
import { TYPE } from "../theme";
import { Icon } from "./Icon";

/**
 * A page opened from the menu (Family, Settings, a person): a back arrow and the title, then the content scrolling below.
 * `scrollRef` lets a page scroll itself (a person's summary jumps to a section).
 */
export function Page({ title, children, right, scrollRef }: { title: string; children: React.ReactNode; right?: React.ReactNode; scrollRef?: React.RefObject<ScrollView | null> }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={t.dark ? "light" : "dark"} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingTop: insets.top + 6, paddingBottom: 6, paddingHorizontal: 6, backgroundColor: t.bg }}>
        <Pressable onPress={back} accessibilityLabel="Back" accessibilityRole="button" hitSlop={4} android_ripple={{ color: withAlpha(t.ink, 0.12), borderless: true, radius: 22 }} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Icon name="chevron-left" size={28} color={t.ink2} />
        </Pressable>
        <Text style={[TYPE.titleLarge, { color: t.ink, flex: 1 }]} numberOfLines={1}>{title}</Text>
        {right}
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 48 }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

/** A titled part of a page. */
export function Section({ title, children, first }: { title: string; children: React.ReactNode; first?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: first ? 4 : 28 }}>
      <Text style={[TYPE.titleMedium, { color: t.ink, marginBottom: 10 }]}>{title}</Text>
      {children}
    </View>
  );
}
