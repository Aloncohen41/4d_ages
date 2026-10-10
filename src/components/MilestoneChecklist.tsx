import React, { useMemo, useState } from "react";
import { Alert, Pressable, Text, ToastAndroid, View } from "react-native";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useShownChild, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { AREAS, BANDS, MILESTONE_CATALOG, MILESTONE_DEFS, Memory, MilestoneDef } from "../lib/types";
import { milestonesLogged } from "../lib/selectors";
import { AREA_META, areaInk, areaSoft, ageChip, ageMonths, celebration, areaOf, bandIndex, bandLabel, bandOfDef, memoryForDef, pastChart, suggestionsFor } from "../lib/development";
import { logMilestone } from "../lib/saveMilestone";
import { formatDate, parseISO, toISO, todayISO } from "../lib/date";
import { Btn, Seg } from "./ui";
import { Icon, IconName } from "./Icon";
import { TYPE } from "../theme";

type View3 = "earlier" | "now" | "next";

/**
 * Every milestone is already here. Tap an empty circle to tick it off with today's date, at once (tap again to undo); the date is shown and can
 * be tapped to change it, and the pencil adds a note, photos and tags. "Select" ticks several at once and gives them one date. Only what has
 * been reached is ever counted — there is no "out of".
 */
export function MilestoneChecklist() {
  const t = useTheme();
  const child = useShownChild();
  const memories = useStore((s) => s.memories);
  const customDefs = useStore((s) => s.customDefs);
  const answers = useStore((s) => s.milestoneAnswers);
  const answerNotYet = useStore((s) => s.answerNotYet);
  const removeMemory = useStore((s) => s.removeMemory);
  const updateMemory = useStore((s) => s.updateMemory);
  const setEntrySheet = useStore((s) => s.setEntrySheet);
  const [view, setView] = useState<View3>("now");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const today = todayISO();
  const logged = useMemo(() => (child ? milestonesLogged(memories, child.id) : {}), [memories, child]);
  const custom = useMemo(() => (child ? customDefs[child.id] || [] : []), [customDefs, child]);
  if (!child) return null;

  const months = ageMonths(child.birth, today);
  const beyond = pastChart(months);
  const bi = bandIndex(months);
  const mine = memories.filter((m) => m.childId === child.id && m.type === "milestone");
  const notYet = answers[child.id] || {};
  const bands = view === "now" ? (beyond ? [] : [bi]) : view === "earlier" ? BANDS.map((_, i) => i).filter((i) => i < (beyond ? BANDS.length : bi)) : BANDS.map((_, i) => i).filter((i) => !beyond && i > bi).slice(0, 2);
  const inView = MILESTONE_CATALOG.filter((d) => bands.includes(bandOfDef(d)));
  const suggestions = view === "now" ? suggestionsFor(MILESTONE_CATALOG, logged, notYet, months, today, 4) : [];
  // milestones you logged that aren't in the chart (your own, or from an earlier version of the app)
  const inChart = new Set(MILESTONE_CATALOG.flatMap((d) => [d.id, ...(d.aliases || [])]));
  const others = mine.filter((m) => !inChart.has(m.milestoneId ?? ""));
  const nameOf = (m: Memory) => [...MILESTONE_DEFS, ...custom].find((d) => d.id === m.milestoneId)?.label ?? m.title ?? "Milestone";

  const toast = (msg: string) => ToastAndroid.show(msg, ToastAndroid.SHORT);
  const tick = (def: MilestoneDef, date: string) => {
    const problem = logMilestone({ childId: child.id, defId: def.id, title: def.label, emoji: def.emoji, date, tagIds: [], note: "", media: [] });
    if (problem) toast(problem);
    else toast(`${def.label}: added to ${child.name}'s story`);
  };
  // ticking is instant and uses today's date; tap the date afterwards to change it
  const reach = (def: MilestoneDef) => tick(def, today);
  const pickDate = (current: string, onPick: (date: string) => void) =>
    DateTimePickerAndroid.open({
      value: parseISO(current),
      mode: "date",
      minimumDate: parseISO(child.birth),
      maximumDate: new Date(),
      onChange: (e, d) => { if (e.type === "set" && d) onPick(toISO(d)); },
    });
  const changeDate = (m: Memory) => pickDate(m.date, (date) => { updateMemory(m.id, { date }); toast(`Date changed to ${formatDate(date)}`); });
  const toggleSelected = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const endSelecting = () => { setSelecting(false); setSelected([]); };
  /** One date for every selected milestone: ticked ones move to it, the others are ticked on it. */
  const dateSelected = () =>
    pickDate(today, (date) => {
      const defs = [...MILESTONE_CATALOG, ...custom].filter((d) => selected.includes(d.id));
      for (const d of defs) {
        const m = memoryForDef(d, logged);
        if (m) updateMemory(m.id, { date });
        else logMilestone({ childId: child.id, defId: d.id, title: d.label, emoji: d.emoji, date, tagIds: [], note: "", media: [] });
      }
      toast(`${defs.length} milestone${defs.length === 1 ? "" : "s"} dated ${formatDate(date)}`);
      endSelecting();
    });
  const undo = (m: Memory) => {
    const rich = !!(m.description || m.media.length || m.tagIds.length || m.location || m.time);
    if (!rich) {
      removeMemory(m.id);
      toast("Unticked");
      return;
    }
    Alert.alert("Untick this milestone?", "The notes, photos and tags you added to it will be removed too.", [
      { text: "Keep it", style: "cancel" },
      { text: "Untick", style: "destructive", onPress: () => { removeMemory(m.id); toast("Unticked"); } },
    ]);
  };
  const edit = (def: MilestoneDef) => setEntrySheet({ kind: "milestone", editId: def.id });

  // a plain function (not a component) so rows aren't rebuilt every time something changes
  const renderRow = (def: MilestoneDef) => {
    const m = memoryForDef(def, logged);
    const meta = AREA_META[areaOf(def)];
    const picked = selected.includes(def.id);
    if (selecting) {
      // choosing which ones to date: tapping a row selects it (nothing is ticked until a date is set)
      return (
        <Pressable key={def.id} onPress={() => toggleSelected(def.id)} accessibilityRole="checkbox" accessibilityState={{ checked: picked }} accessibilityLabel={def.label} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 4, borderRadius: 12, backgroundColor: picked ? areaSoft(meta, t) : "transparent" }}>
          <View style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: picked ? areaInk(meta, t) : t.outline, backgroundColor: picked ? meta.color : "transparent", alignItems: "center", justifyContent: "center" }}>
              {picked ? <Icon name="check" size={15} color={meta.ink} /> : null}
            </View>
          </View>
          <View style={{ flex: 1, paddingVertical: 6, paddingRight: 6 }}>
            <Text style={{ color: t.ink, fontWeight: m ? "800" : "600", fontSize: 14.5, lineHeight: 19 }}>{def.label}</Text>
            {m ? <Text style={{ color: t.ink3, fontSize: 12, marginTop: 1 }}>{formatDate(m.date)}</Text> : null}
          </View>
        </Pressable>
      );
    }
    return (
      <View key={def.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 4 }}>
        <Pressable onPress={() => (m ? undo(m) : reach(def))} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: !!m }} accessibilityLabel={def.label} style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: m ? 1.5 : 2.5, borderColor: m ? areaInk(meta, t) : t.outline, backgroundColor: m ? meta.color : "transparent", alignItems: "center", justifyContent: "center" }}>
            {m ? <Icon name="check" size={16} color={meta.ink} /> : null}
          </View>
        </Pressable>
        <View style={{ flex: 1, paddingVertical: 6, paddingRight: 6 }}>
          <Pressable onPress={() => (m ? edit(def) : reach(def))}>
            <Text style={{ color: t.ink, fontWeight: m ? "800" : "600", fontSize: 14.5, lineHeight: 19 }}>{def.label}</Text>
          </Pressable>
          {m ? (
            <Pressable onPress={() => changeDate(m)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Reached ${formatDate(m.date)}. Change the date`} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2, alignSelf: "flex-start" }}>
              <Icon name="calendar" size={13} color={areaInk(meta, t)} />
              <Text style={{ color: areaInk(meta, t), fontSize: 12, fontWeight: "700", textDecorationLine: "underline" }}>{formatDate(m.date)}</Text>
              {m.description ? <Text style={{ color: t.ink3, fontSize: 12 }} numberOfLines={1}> · {m.description}</Text> : null}
            </Pressable>
          ) : null}
        </View>
        {m ? (
          <Pressable onPress={() => edit(def)} hitSlop={8} accessibilityLabel={`Edit ${def.label}`} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: areaSoft(meta, t), alignItems: "center", justifyContent: "center" }}>
            <Icon name="edit-2" size={15} color={areaInk(meta, t)} />
          </Pressable>
        ) : null}
      </View>
    );
  };

  const reached = mine.length;
  return (
    <View>
      {/* a celebration, never a score */}
      <View style={{ backgroundColor: t.accentSoft, borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.gold, alignItems: "center", justifyContent: "center" }}><Icon name="star" size={22} color={t.goldInk} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.titleLarge, { color: t.ink }]}>{celebration(reached, child.name).title}</Text>
          <Text style={{ color: t.ink2, fontSize: 12.5, marginTop: 1 }}>{celebration(reached, child.name).sub}</Text>
        </View>
      </View>

      <View style={{ marginTop: 14 }}>
        <Seg options={[{ id: "earlier" as View3, label: "Earlier" }, { id: "now" as View3, label: `Now · ${ageChip(months)}` }, { id: "next" as View3, label: "Coming up" }]} value={view} onChange={setView} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
        <Text style={{ color: t.ink3, fontSize: 12.5, flex: 1 }}>{selecting ? "Tap the milestones to date together." : "Tap a circle to tick it with today's date."}</Text>
        <Pressable onPress={() => (selecting ? endSelecting() : setSelecting(true))} hitSlop={6} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 10 }}>
          <Icon name={selecting ? "x" : "select"} size={16} color={t.accentDeep} />
          <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 13 }}>{selecting ? "Cancel" : "Select"}</Text>
        </Pressable>
      </View>
      {selecting ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6, backgroundColor: t.surfaceHigh, borderRadius: 16, padding: 10 }}>
          <Text style={[TYPE.labelLarge, { color: t.ink, flex: 1, paddingLeft: 6 }]}>{selected.length} selected</Text>
          <Btn label="Set date" icon="calendar" onPress={dateSelected} disabled={!selected.length} />
        </View>
      ) : null}

      {suggestions.length ? (
        <View style={{ backgroundColor: t.card, borderRadius: 20, borderWidth: 1, borderColor: t.line, padding: 14, marginTop: 14 }}>
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15 }}>Is this happening?</Text>
          <Text style={{ color: t.ink3, fontSize: 12.5, marginTop: 2, marginBottom: 6 }}>Tap Yes if you've seen it. No pressure either way.</Text>
          {suggestions.map((d) => (
            <View key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, borderTopWidth: 1, borderTopColor: t.line }}>
              <Text style={{ flex: 1, color: t.ink, fontWeight: "700", fontSize: 14 }}>{d.label}</Text>
              <Pressable onPress={() => reach(d)} style={{ backgroundColor: AREA_META[areaOf(d)].color, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8 }}><Text style={{ color: AREA_META[areaOf(d)].ink, fontWeight: "700", fontSize: 12.5 }}>Yes!</Text></Pressable>
              <Pressable onPress={() => answerNotYet(child.id, d.id, today)} style={{ backgroundColor: t.bg2, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 }}><Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12.5 }}>Not yet</Text></Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {view === "now" && beyond ? (
        <Text style={{ color: t.ink3, textAlign: "center", padding: 24, lineHeight: 20 }}>{child.name} has grown past the 0–36 month chart.{"\n"}Everything you ticked is under Earlier, and you can add your own milestones below.</Text>
      ) : null}
      {view === "next" && (beyond || !inView.length) ? <Text style={{ color: t.ink3, textAlign: "center", padding: 24 }}>Nothing further along the chart.</Text> : null}

      {AREAS.map((area) => {
        const list = inView.filter((d) => areaOf(d) === area).sort((a, b) => bandOfDef(a) - bandOfDef(b));
        if (!list.length) return null;
        const meta = AREA_META[area];
        const done = list.filter((d) => memoryForDef(d, logged)).length;
        return (
          <View key={area} style={{ backgroundColor: t.card, borderRadius: 20, borderWidth: 1, borderColor: t.line, marginTop: 14, overflow: "hidden" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: areaSoft(meta, t), paddingHorizontal: 14, paddingVertical: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: meta.color, alignItems: "center", justifyContent: "center" }}><Icon name={meta.icon as IconName} size={18} color={meta.ink} /></View>
              <Text style={{ flex: 1, color: t.ink, fontWeight: "700", fontSize: 16 }}>{meta.label}</Text>
              {done >= 2 ? <Text style={{ color: areaInk(meta, t), fontWeight: "700", fontSize: 12.5 }}>{done} reached</Text> : done === 1 ? <Icon name="star" size={15} color={areaInk(meta, t)} /> : null}
            </View>
            <View style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
              {list.map((d, i) => (
                <View key={d.id}>
                  {bands.length > 1 && (i === 0 || bandOfDef(list[i - 1]) !== bandOfDef(d)) ? <Text style={{ color: t.ink4, fontWeight: "700", fontSize: 11, marginLeft: 8, marginTop: 8 }}>{bandLabel(bandOfDef(d))}</Text> : null}
                  {renderRow(d)}
                </View>
              ))}
            </View>
          </View>
        );
      })}

      {others.length ? (
        <View style={{ backgroundColor: t.card, borderRadius: 20, borderWidth: 1, borderColor: t.line, marginTop: 14, padding: 14 }}>
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15, marginBottom: 4 }}>Your other milestones</Text>
          {others.map((m) => {
            const meta = AREA_META[areaOf([...MILESTONE_DEFS, ...custom].find((d) => d.id === m.milestoneId) ?? {})];
            return (
              <Pressable key={m.id} onPress={() => m.milestoneId && setEntrySheet({ kind: "milestone", editId: m.milestoneId })} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: meta.color, borderWidth: 1.5, borderColor: areaInk(meta, t), alignItems: "center", justifyContent: "center" }}><Icon name="check" size={16} color={meta.ink} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.ink, fontWeight: "700", fontSize: 14.5 }}>{nameOf(m)}</Text>
                  <Text style={{ color: t.ink3, fontSize: 12 }}>{formatDate(m.date)}</Text>
                </View>
                <Icon name="edit-2" size={15} color={t.ink3} />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Btn label="Add a milestone of your own" icon="plus" kind="line" onPress={() => setEntrySheet({ kind: "milestone" })} style={{ marginTop: 16 }} />
    </View>
  );
}
