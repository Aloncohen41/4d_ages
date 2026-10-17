import React, { useMemo } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Btn, Heading, Seg } from "./ui";
import { LineChart } from "./GrowthChart";
import { useShownChild, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { weightSeries } from "../lib/selectors";
import { formatDate } from "../lib/date";
import { WeightUnit, formatWeight } from "../lib/growth";
import { isPet } from "../lib/types";
import { petAge } from "../lib/pets";
import { TYPE } from "../theme";
import { WeightComparisons } from "./WeightComparisons";

import { tr } from "../lib/i18n";
/** A pet's weight: the latest, the change since the one before, a chart over time, and every weighing. */
export function PetWeight() {
  const t = useTheme();
  const child = useShownChild();
  const memories = useStore((s) => s.memories);
  const wUnit = useStore((s) => s.weightUnit);
  const setWeightUnit = useStore((s) => s.setWeightUnit);
  const setEntrySheet = useStore((s) => s.setEntrySheet);
  const removeMemory = useStore((s) => s.removeMemory);
  const weights = useMemo(() => (child ? weightSeries(memories, child.id) : []), [memories, child]);
  if (!child || !isPet(child)) return null;
  const latest = weights[weights.length - 1];
  const prev = weights[weights.length - 2];
  const viewOnly = child.role === "viewer";
  const change = latest && prev ? latest.kg - prev.kg : 0;

  return (
    <View>
      <Text style={[TYPE.bodyMedium, { color: t.ink3, marginBottom: 12 }]}>{tr("{0}'s weight over time. Weigh them now and then, and add it here.", [child.name])}</Text>
      {!viewOnly ? <Btn label={tr("Add a weight")} icon="scale" onPress={() => setEntrySheet({ kind: "measure" })} /> : null}
      <View style={{ marginTop: 12, width: 160 }}>
        <Seg options={[{ id: "kg" as WeightUnit, label: "kg" }, { id: "lb" as WeightUnit, label: "lb" }]} value={wUnit} onChange={setWeightUnit} />
      </View>
      {latest ? (
        <>
          <View style={{ backgroundColor: t.accentSoft, borderRadius: 22, padding: 18, marginTop: 14 }}>
            <Text style={[TYPE.labelLarge, { color: t.onAccentSoft }]}>{tr("Latest · {0} · {1}", [formatDate(latest.date), petAge({ ...child, birth: child.birth }, latest.date).human])}</Text>
            <Text style={[TYPE.displaySmall ?? TYPE.headlineLarge, { color: t.onAccentSoft, marginTop: 4 }]}>{formatWeight(latest.kg, wUnit)}</Text>
            {prev ? <Text style={[TYPE.bodyMedium, { color: t.onAccentSoft, marginTop: 2 }]}>{change === 0 ? tr("The same as last time") : tr("{0}{1} since {2}", [change > 0 ? "+" : "−", formatWeight(Math.abs(change), wUnit), formatDate(prev.date)])}</Text> : null}
          </View>
          <WeightComparisons kg={latest.kg} />
          {weights.length > 1 ? (
            <View style={{ marginTop: 16 }}>
              <LineChart child={child} entries={weights} unit="cm" mode="weight" weightUnit={wUnit} centiles={false} />
            </View>
          ) : null}
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 17, marginTop: 22, marginBottom: 8 }}>{tr("Every weighing")}</Text>
          {[...weights].reverse().map((e) => (
            <Pressable key={e.id} onPress={() => !viewOnly && setEntrySheet({ kind: "measure", editId: e.id })}
              onLongPress={() => !viewOnly && Alert.alert(tr("Remove this weight?"), formatDate(e.date), [{ text: tr("Cancel"), style: "cancel" }, { text: tr("Remove"), style: "destructive", onPress: () => removeMemory(e.id) }])}
              style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.line }}>
              <Text style={[TYPE.bodyLarge, { color: t.ink }]}>{formatWeight(e.kg, wUnit)}</Text>
              <Text style={[TYPE.bodyMedium, { color: t.ink3 }]}>{formatDate(e.date)}</Text>
            </Pressable>
          ))}
        </>
      ) : (
        <Text style={[TYPE.bodyMedium, { color: t.ink3, marginTop: 16, textAlign: "center" }]}>{tr("No weights yet. The first one starts the chart.")}</Text>
      )}
    </View>
  );
}
