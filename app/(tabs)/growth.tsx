import React, { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { Btn, Heading, Label, PhotoView, Seg } from "../../src/components/ui";
import { TagRow } from "../../src/components/TagChip";
import { Icon } from "../../src/components/Icon";
import { DoorFrame, LineChart } from "../../src/components/GrowthChart";
import { GrowthSummary } from "../../src/components/GrowthSummary";
import { PregnancyGrowth } from "../../src/components/Pregnancy";
import { PetCare } from "../../src/components/PetHealth";
import { PetWeight } from "../../src/components/PetWeight";
import { useShownChild, useStore } from "../../src/lib/store";
import { useTheme } from "../../src/lib/useTheme";
import { coverOf } from "../../src/lib/display";
import { headSeries, heightSeries, weightSeries } from "../../src/lib/selectors";
import { GrowthRef, isPet } from "../../src/lib/types";
import { ageShort, formatDate } from "../../src/lib/date";
import { HeightUnit, WeightUnit, effectiveRef, formatHeight, formatWeight, funComparisons, heightInThings, monthsOld, nextUp, rangeStatus } from "../../src/lib/growth";
import { WeightComparisons } from "../../src/components/WeightComparisons";
import { TYPE } from "../../src/theme";

import { tr } from "../../src/lib/i18n";
export default function GrowthTab() {
  return (
    <Screen>
      <Growth />
    </Screen>
  );
}

/** A pet's Health: their health (visits, treatments, details, reminders) and their weight, one switch apart. */
function PetHealthTab() {
  const t = useTheme();
  const [part, setPart] = useState<"health" | "weight">("health");
  return (
    <View>
      <Text style={[TYPE.headlineSmall, { color: t.ink, marginBottom: 12 }]}>{tr("Health")}</Text>
      <View style={{ marginBottom: 14 }}>
        <Seg options={[{ id: "health" as const, label: tr("Health") }, { id: "weight" as const, label: tr("Weight") }]} value={part} onChange={setPart} />
      </View>
      {part === "health" ? <PetCare /> : <PetWeight />}
    </View>
  );
}

/** A few "as tall as…" comparisons from different categories, plus what's next. */
function Comparisons({ cm, unit }: { cm: number; unit: HeightUnit }) {
  const t = useTheme();
  const [offset, setOffset] = useState(0);
  const list = funComparisons(cm, 3, offset);
  const next = nextUp(cm);
  const stack = heightInThings(cm, offset); // "As tall as 104 pencils, end to end"
  if (!list.length) return <Text style={{ color: t.ink3, marginTop: 10 }}>{tr("Comparisons start once they're 20 cm — a banana!")}</Text>;
  return (
    <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: t.line, paddingTop: 12 }}>
      <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12, marginBottom: 8 }}>{tr("How tall is that?")}</Text>
      {list.map(({ ref, phrase }) => (
        <View key={ref.name} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: t.bg2, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 24 }}>{ref.emoji}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontWeight: "700", fontSize: 14 }}>{phrase} {ref.name}</Text>
            <Text style={{ color: t.ink4, fontSize: 11.5 }}>{tr("{0} · about {1}", [ref.category, formatHeight(ref.cm, unit)])}</Text>
          </View>
        </View>
      ))}
      {stack ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 24 }}>{stack.ref.emoji}</Text></View>
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 14, flex: 1 }}>{stack.text}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
        {next ? <Text style={{ color: t.ink3, fontSize: 12, flex: 1 }}>{tr("Next up: {0}, {1} to go", [next.ref.name, formatHeight(next.gap, unit)])}</Text> : <View />}
        <Pressable onPress={() => setOffset((o) => o + 1)} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Icon name="refresh-cw" size={14} color={t.accentDeep} /><Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12.5 }}>{tr("More")}</Text></Pressable>
      </View>
    </View>
  );
}

function Growth() {
  const t = useTheme();
  const child = useShownChild();
  const memories = useStore((s) => s.memories);
  const unit = useStore((s) => s.heightUnit);
  const wUnit = useStore((s) => s.weightUnit);
  const removeMemory = useStore((s) => s.removeMemory);
  const updateChild = useStore((s) => s.updateChild);
  const setEntrySheet = useStore((s) => s.setEntrySheet);
  const [mode, setMode] = useState<"height" | "weight" | "head">("height");

  // heights and weights are read from the measurement memories — there is no separate copy
  const heights = useMemo(() => (child ? heightSeries(memories, child.id) : []), [memories, child]);
  const weights = useMemo(() => (child ? weightSeries(memories, child.id) : []), [memories, child]);
  const heads = useMemo(() => (child ? headSeries(memories, child.id) : []), [memories, child]);
  if (!child) return null;
  if (isPet(child)) return <PetHealthTab />;
  // before the birth: the week, the baby's size as a fruit, ultrasound pictures and scan measurements
  if (child.expecting) {
    return (
      <View>
        <Heading title={tr("Growth")} />
        <PregnancyGrowth child={child} />
      </View>
    );
  }

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
    const both = [m?.heightCm, m?.weightKg, m?.headCm].filter((x) => x != null).length > 1;
    Alert.alert(tr("Remove this measurement?"), `${label}${both ? ". This removes everything measured together that day." : ""}`, [
      { text: tr("Cancel"), style: "cancel" },
      { text: tr("Remove"), style: "destructive", onPress: () => removeMemory(id) },
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
        <Pressable onPress={() => confirmDelete(id, `${main} on ${formatDate(date)}`)} hitSlop={10} accessibilityLabel={tr("Delete")}><Icon name="trash-2" size={19} color={t.danger} /></Pressable>
      </Pressable>
    );
  };

  const empty = mode === "height" ? !latest : mode === "weight" ? !latestW : !heads.length;

  return (
    <View>
      <Heading title={tr("Growth")} />
      <Btn label={tr("Add a measurement")} icon="add-measure" onPress={() => setEntrySheet({ kind: "measure" })} />
      <GrowthSummary child={child} memories={memories} />
      <View style={{ marginTop: 12, flexDirection: "row", gap: 10, alignItems: "center" }}>
        {/* units (cm or in, kg or lb) are chosen in Settings */}
        <View style={{ flex: 1 }}><Seg options={[{ id: "height" as const, label: tr("Height") }, { id: "weight" as const, label: tr("Weight") }, { id: "head" as const, label: tr("Head") }]} value={mode} onChange={setMode} /></View>
      </View>

      {empty ? (
        <View style={{ alignItems: "center", padding: 30 }}>
          <Icon name={mode === "weight" ? "scale" : "add-measure"} size={44} color={t.ink3} />
          <Text style={{ color: t.ink, fontWeight: "700", marginTop: 6 }}>{tr("No {0} logged yet", [mode === "head" ? "head measurement" : mode])}</Text>
          <Text style={{ color: t.ink3, textAlign: "center", marginTop: 4 }}>{mode === "height" ? tr("Measure {0} lying down (before 2) or standing, then tap “Add a measurement”.", [child.name]) : mode === "head" ? tr("Measure around the widest part of the head, then tap “Add a measurement”.") : tr("Tap “Add a measurement” after the next weigh-in.")}</Text>
        </View>
      ) : mode === "height" && latest ? (
        <>
          <View style={{ backgroundColor: t.card, borderRadius: 22, borderWidth: 1, borderColor: t.line, padding: 18, marginTop: 16 }}>
            <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12 }}>{tr("Latest height · {0}", [formatDate(latest.date)])}</Text>
            <Text style={{ color: t.ink, fontWeight: "700", fontSize: 34, marginTop: 2 }}>{formatHeight(latest.cm, unit)}</Text>
            {prev ? <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12.5 }}>{tr("{0}{1} since {2}", [latest.cm >= prev.cm ? "+" : "", formatHeight(latest.cm - prev.cm, unit), formatDate(prev.date)])}</Text> : null}
            <Comparisons cm={latest.cm} unit={unit} />
            {status ? <Text style={{ color: t.ink3, marginTop: 10, fontSize: 12.5 }}>{tr("Height is {0} for {1} this age. Every child grows in their own way.", [statusText[status], ref === "boy" ? "boys" : ref === "girl" ? "girls" : "children"])}</Text> : null}
          </View>

          <Label>{tr("Compare with a typical range")}</Label>
          <Seg options={[{ id: "girl" as GrowthRef, label: tr("Girls") }, { id: "boy" as GrowthRef, label: tr("Boys") }, { id: "all" as GrowthRef, label: tr("All") }]} value={ref} onChange={(v) => updateChild(child.id, { growthRef: v })} />
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 17, marginTop: 20, marginBottom: 8 }}>{tr("Height curve")}</Text>
          <LineChart child={child} entries={heights} unit={unit} />
          <Text style={{ color: t.ink4, fontSize: 11, marginTop: 6 }}>{tr("Lines: the 3rd, 50th and 97th percentiles for their age and sex, from the charts chosen in Settings. For information only. Ask your doctor or health visitor about growth.")}</Text>
          <Text style={[TYPE.titleMedium, { color: t.ink, marginTop: 22, marginBottom: 8 }]}>{tr("The door frame")}</Text>
          <DoorFrame child={child} entries={heights} unit={unit} />
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 17, marginTop: 22, marginBottom: 8 }}>{tr("History")}</Text>
          {[...heights].reverse().map((e) => row(e.id, formatHeight(e.cm, unit), e.date))}
        </>
      ) : mode === "head" ? (
        <>
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 17, marginTop: 20, marginBottom: 8 }}>{tr("History")}</Text>
          {[...heads].reverse().map((e) => row(e.id, formatHeight(e.cm, unit), e.date))}
        </>
      ) : latestW ? (
        <>
          <View style={{ backgroundColor: t.card, borderRadius: 22, borderWidth: 1, borderColor: t.line, padding: 18, marginTop: 16 }}>
            <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12 }}>{tr("Latest weight · {0}", [formatDate(latestW.date)])}</Text>
            <Text style={{ color: t.ink, fontWeight: "700", fontSize: 34, marginTop: 2 }}>{formatWeight(latestW.kg, wUnit)}</Text>
            {prevW ? <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12.5 }}>{tr("{0}{1} since {2}", [latestW.kg >= prevW.kg ? "+" : "", formatWeight(latestW.kg - prevW.kg, wUnit), formatDate(prevW.date)])}</Text> : null}
          </View>
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 17, marginTop: 20, marginBottom: 8 }}>{tr("Weight curve")}</Text>
          <LineChart child={child} entries={weights} unit={unit} mode="weight" weightUnit={wUnit} />
          {latestW ? <WeightComparisons kg={latestW.kg} /> : null}
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 17, marginTop: 22, marginBottom: 8 }}>{tr("History")}</Text>
          {[...weights].reverse().map((e) => row(e.id, formatWeight(e.kg, wUnit), e.date))}
        </>
      ) : null}
    </View>
  );
}
