import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Page } from "../src/components/Page";
import { Icon } from "../src/components/Icon";
import { useShownChild, useStore } from "../src/lib/store";
import { useTheme } from "../src/lib/useTheme";
import { CLASSICS, filledCount } from "../src/lib/classics";
import { TYPE } from "../src/theme";

/**
 * Classics: the fill-in pages of a printed baby book (teeth, the birth story, food, favourite toys, the first haircut…). Each one is filled in
 * whenever you like, and the filled ones are added to the keepsake book.
 */
export default function ClassicsPage() {
  const t = useTheme();
  const child = useShownChild();
  const classics = useStore((s) => s.classics);
  if (!child) return null;
  const viewOnly = child.role === "viewer";
  return (
    <Page title="Classics">
      <Text style={[TYPE.bodyMedium, { color: t.ink2, marginBottom: 14 }]}>
        {viewOnly ? `These pages are kept by ${child.name}'s parents.` : `The pages of a classic baby book, for ${child.name}. Fill in any of them, any time. The ones you fill in are added to the keepsake book.`}
      </Text>
      {viewOnly ? null : CLASSICS.map((tpl) => {
        const entry = classics.find((c) => c.childId === child.id && c.id === tpl.id);
        const filled = filledCount(tpl, entry);
        return (
          <Pressable key={tpl.id} onPress={() => router.push({ pathname: "/classic/[id]", params: { id: tpl.id } })} accessibilityRole="button"
            style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: filled ? t.accent : t.line, backgroundColor: t.card, marginBottom: 8 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: filled ? t.accentSoft : t.bg2, alignItems: "center", justifyContent: "center" }}>
              <Icon name={tpl.icon} size={24} color={filled ? t.onAccentSoft : t.ink2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[TYPE.titleSmall, { color: t.ink }]}>{tpl.title}</Text>
              <Text style={[TYPE.bodySmall, { color: t.ink3 }]} numberOfLines={2}>{filled ? `${filled} of ${tpl.fields.length} filled in` : tpl.desc}</Text>
            </View>
            <Icon name={filled ? "check" : "chevron-right"} size={20} color={filled ? t.accentDeep : t.ink3} />
          </Pressable>
        );
      })}
    </Page>
  );
}
