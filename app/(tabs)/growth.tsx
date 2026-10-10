import React, { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { Btn, Heading, Label, PhotoView, Seg } from "../../src/components/ui";
import { TagRow } from "../../src/components/TagChip";
import { Icon } from "../../src/components/Icon";
import { DoorFrame, LineChart } from "../../src/components/GrowthChart";
import { useShownChild, useStore } from "../../src/lib/store";
import { useTheme } from "../../src/lib/useTheme";
import { coverOf } from "../../src/lib/display";
import { heightSeries, weightSeries } from "../../src/lib/selectors";
import { GrowthRef } from "../../src/lib/types";
import { ageShort, formatDate } from "../../src/lib/date";
import { HeightUnit, WeightUnit, effectiveRef, formatHeight, formatWeight, funComparisons, monthsOld, nextUp, rangeStatus } from "../../src/lib/growth";
import { TYPE } from "../../src/theme";

export default function GrowthTab() {
  return (
    <Screen>
      <Growth />
    </Screen>
  );
}

/** A few "as tall as…" comparisons from different categories, plus what's next. */
function Comparisons({ cm, unit }: { cm: number; unit: HeightUnit }) {
  const t = useTheme();
  const [offset, setOffset] = useState(0);
  const list = funComparisons(cm, 3, offset);
  const next = nextUp(cm);
  if (!list.length) return <Text style={{ color: t.ink3, marginTop: 10 }}>Comparisons start once they're 20 cm — a banana!</Text>;
  return (
    <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: t.line, paddingTop: 12 }}>
      <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12, marginBottom: 8 }}>How tall is that?</Text>
      {list.map(({ ref, phrase }) => (
        <View key={ref.name} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: t.bg2, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 24 }}>{ref.emoji}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontWeight: "700", fontSize: 14 }}>{phrase} {ref.name}</Text>
            <Text style={{ color: t.ink4, fontSize: 11.5 }}>{ref.category} · about {formatHeight(ref.cm, unit)}</Text>
          </View>
        </View>
      ))}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
        {next ? <Text style={{ color: t.ink3, fontSize: 12, flex: 1 }}>Next up: {next.ref.name}, {formatHeight(next.gap, unit)} to go</Text> : <View />}
        <Pressable onPress={() => setOffset((o) => o + 1)} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Icon name="refresh-cw" size={14} color={t.accentDeep} /><Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12.5 }}>More</Text></Pressable>
      </View>
    </View>
  );
}

function Growth() {
  const t = useTheme();
  const child = useShownChild();
  const memories = useStore((s) => s.memories);
  const unit = useStore((s) => s.heightUnit);
  const setUnit = useStore((s) => s.setHeightUnit);
  const wUnit = useStore((s) => s.weightUnit);
  const setWUnit = useStore((s) => s.setWeightUnit);
  const removeMemory = useStore((s) => s.removeMemory);
  const updateChild = useStore((s) => s.updateChild);
  const setEntrySheet = useStore((s) => s.setEntrySheet);
  const [mode, setMode] = useState<"height" | "weight">("height");

  // heights and weights are read from the measurement memories — there is no separate copy
  const heights = useMemo(() => (child ? heightSeries(memories, child.id) : []), [memories, child]);
  const weights = useMemo(() => (child ? weightSeries(memories, child.id) : []), [memories, child]);
  if (!child) return null;

  const latest = heights[heights.length - 1];
  const prev = heights[heights.length - 2];
  const latestW = weights[weights.length - 1];
  const prevW = weights[weights.length - 2];
  // Girls / Boys / All: the parent's choice, or by default the child's gender (Prefer not to say → All)
  const ref = effectiveRef(child);
  const status = latest ? rangeStatus(ref, monthsOld(child.birth, latest.date), latest.cm) : null;
  const statusText = { below: "a little below the typical range", within: "within the typical range", above: "a little above the typical range" };

  const confirmDelete = (id: string, label: string) => {
    const m = memories.find((x) => x.id === id);
    const both = m?.heightCm != null && m?.weightKg != null;
    Alert.alert("Remove this measurement?", `${label}${both ? " — this removes the height and the weight logged together." : ""}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeMemory(id) },
    ]);
  };

  const row = (id: string, main: string, date: string) => {
    const card = memories.find((p) => p.id === id);
    const cover = card ? coverOf(card.media) : null;
    return (
      <Pressable key={id} onPress={() => card && setEntrySheet({ kind: "measure", editId: card.id })} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.line, padding: 12, marginBottom: 8 }}>
        {cover ? <PhotoView photo={{ uri: cover.uri, kind: cover.kind, emoji: "📷", palette: "sage" }} style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden" }} emojiSize={18} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.ink, fontWeight: "700" }}>{main}</Text>
          <Text style={{ color: t.ink3, fontSize: 12 }}>{formatDate(date)} · {ageShort(child.birth, date)}</Text>
          {card?.description || card?.title ? <Text style={{ color: t.ink2, fontSize: 12.5, marginTop: 2 }} numberOfLines={2}>{card.title ? `${card.title}${card.description ? " — " : ""}` : ""}{card.description}</Text> : null}
          {card ? <View style={{ marginTop: 4 }}><TagRow item={card} small /></View> : null}
        </View>
        <Pressable onPress={() => confirmDelete(id, `${main} on ${formatDate(date)}`)} hitSlop={10} accessibilityLabel="Delete"><Icon name="trash-2" size={19} color={t.danger} /></Pressable>
      </Pressable>
    );
  };

  const empty = mode === "height" ? !latest : !latestW;

  return (
    <View>
      <Heading title="Growth" />
      <Btn label="Add height / weight" icon="add-measure" onPress={() => setEntrySheet({ kind: "measure" })} />
      <View style={{ marginTop: 12, flexDirection: "row", gap: 10, alignItems: "center" }}>
        <View style={{ flex: 1.4 }}><Seg options={[{ id: "height" as const, label: "Height" }, { id: "weight" as const, label: "Weight" }]} value={mode} onChange={setMode} /></View>
        <View style={{ flex: 1 }}>
          {mode === "height" ? <Seg options={[{ id: "cm" as HeightUnit, label: "cm" }, { id: "in" as HeightUnit, label: "in" }]} value={unit} onChange={setUnit} /> : <Seg options={[{ id: "kg" as WeightUnit, label: "kg" }, { id: "lb" as WeightUnit, label: "lb" }]} value={wUnit} onChange={setWUnit} />}
        </View>
      </View>

      {empty ? (
        <View style={{ alignItems: "center", padding: 30 }}>
          <Icon name={mode === "height" ? "add-measure" : "scale"} size={44} color={t.ink3} />
          <Text style={{ color: t.ink, fontWeight: "700", marginTop: 6 }}>No {mode} logged yet</Text>
          <Text style={{ color: t.ink3, textAlign: "center", marginTop: 4 }}>{mode === "height" ? `Measure ${child.name} lying down (before 2) or standing, then tap “Add height / weight”.` : "Tap “Add height / weight” after the next weigh-in."}</Text>
        </View>
      ) : mode === "height" && latest ? (
        <>
          <View style={{ backgroundColor: t.card, borderRadius: 22, borderWidth: 1, borderColor: t.line, padding: 18, marginTop: 16 }}>
            <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12 }}>Latest height · {formatDate(latest.date)}</Text>
            <Text style={{ color: t.ink, fontWeight: "700", fontSize: 34, marginTop: 2 }}>{formatHeight(latest.cm, unit)}</Text>
            {prev ? <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12.5 }}>{latest.cm >= prev.cm ? "+" : ""}{formatHeight(latest.cm - prev.cm, unit)} since {formatDate(prev.date)}</Text> : null}
            <Comparisons cm={latest.cm} unit={unit} />
            {status ? <Text style={{ color: t.ink3, marginTop: 10, fontSize: 12.5 }}>Height is {statusText[status]} for {ref === "boy" ? "boys" : ref === "girl" ? "girls" : "children"} this age. Every child grows in their own way.</Text> : null}
          </View>

          <Label>Compare with a typical range</Label>
          <Seg options={[{ id: "girl" as GrowthRef, label: "Girls" }, { id: "boy" as GrowthRef, label: "Boys" }, { id: "all" as GrowthRef, label: "All" }]} value={ref} onChange={(v) => updateChild(child.id, { growthRef: v })} />
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 17, marginTop: 20, marginBottom: 8 }}>Height curve</Text>
          <LineChart child={child} entries={heights} unit={unit} />
          <Text style={{ color: t.ink4, fontSize: 11, marginTop: 6 }}>Shaded band: approximate typical range, simplified from the WHO growth standards (0–5 years). For information only. Ask your pediatrician about growth.</Text>
          <Text style={[TYPE.titleMedium, { color: t.ink, marginTop: 22, marginBottom: 8 }]}>The door frame</Text>
          <DoorFrame child={child} entries={heights} unit={unit} />
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 17, marginTop: 22, marginBottom: 8 }}>History</Text>
          {[...heights].reverse().map((e) => row(e.id, formatHeight(e.cm, unit), e.date))}
        </>
      ) : latestW ? (
        <>
          <View style={{ backgroundColor: t.card, borderRadius: 22, borderWidth: 1, borderColor: t.line, padding: 18, marginTop: 16 }}>
            <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12 }}>Latest weight · {formatDate(latestW.date)}</Text>
            <Text style={{ color: t.ink, fontWeight: "700", fontSize: 34, marginTop: 2 }}>{formatWeight(latestW.kg, wUnit)}</Text>
            {prevW ? <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12.5 }}>{latestW.kg >= prevW.kg ? "+" : ""}{formatWeight(latestW.kg - prevW.kg, wUnit)} since {formatDate(prevW.date)}</Text> : null}
          </View>
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 17, marginTop: 20, marginBottom: 8 }}>Weight curve</Text>
          <LineChart child={child} entries={weights} unit={unit} mode="weight" weightUnit={wUnit} />
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 17, marginTop: 22, marginBottom: 8 }}>History</Text>
          {[...weights].reverse().map((e) => row(e.id, formatWeight(e.kg, wUnit), e.date))}
        </>
      ) : null}
    </View>
  );
}
