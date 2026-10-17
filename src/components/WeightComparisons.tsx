import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../lib/useTheme";
import { weightInThings } from "../lib/growth";
import { Icon } from "./Icon";

import { tr } from "../lib/i18n";
/** "As heavy as 5 watermelons": a few things that add up to the weight, for children and pets alike. "More" shows others. */
export function WeightComparisons({ kg }: { kg: number }) {
  const t = useTheme();
  const [turn, setTurn] = useState(0);
  const list = weightInThings(kg, turn);
  if (!list.length) return null;
  return (
    <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: t.line, paddingTop: 12 }}>
      <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12, marginBottom: 8 }}>{tr("How heavy is that?")}</Text>
      {list.map(({ ref, text }) => (
        <View key={ref.name} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: t.bg2, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 24 }}>{ref.emoji}</Text></View>
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 14, flex: 1 }}>{text}</Text>
        </View>
      ))}
      <Pressable onPress={() => setTurn((x) => x + 1)} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end" }}>
        <Icon name="refresh-cw" size={14} color={t.accentDeep} />
        <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12.5 }}>{tr("More")}</Text>
      </Pressable>
    </View>
  );
}
