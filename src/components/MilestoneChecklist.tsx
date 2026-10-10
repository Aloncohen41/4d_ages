import React, { useMemo, useState } from "react";
import { Alert, Pressable, Text, ToastAndroid, View } from "react-native";
import { useShownChild, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { AREAS, BANDS, MILESTONE_CATALOG, MILESTONE_DEFS, Memory, MilestoneDef } from "../lib/types";
import { milestonesLogged } from "../lib/selectors";
import { AREA_META, areaSoft, ageChip, ageMonths, celebration, areaOf, bandIndex, bandLabel, bandOfDef, defaultMilestoneDate, memoryForDef, pastChart, suggestionsFor } from "../lib/development";
import { logMilestone } from "../lib/saveMilestone";
import { addMonths, formatDate, todayISO } from "../lib/date";
import { Btn, DateField, Seg, Sheet } from "./ui";
import { Icon, IconName } from "./Icon";
import { TYPE } from "../theme";

type View3 = "earlier" | "now" | "next";

/**
 * Every milestone is already here. Tap an empty circle to tick it off (tap again to undo); once ticked, a pencil lets you add the
 * date, a note, photos and tags. Only what has been reached is ever counted — there is no "out of".
 */
export function MilestoneChecklist() {
  const t = useTheme();
  const child = useShownChild();
  const memories = useStore((s) => s.memories);
  const customDefs = useStore((s) => s.customDefs);
  const answers = useStore((s) => s.milestoneAnswers);
  const answerNotYet = useStore((s) => s.answerNotYet);
  const removeMemory = useStore((s) => s.removeMemory);
  const setEntrySheet = useStore((s) => s.setEntrySheet);
  const [view, setView] = useState<View3>("now");
  const [asking, setAsking] = useState<MilestoneDef | null>(null);

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
    else toast(`⭐ ${def.label} — added to ${child.name}'s story`);
  };
  const reach = (def: MilestoneDef) => {
    const d = defaultMilestoneDate(def, child.birth, today);
    if (d.ask) setAsking(def); // its usual time is long past, so today's date would be wrong: ask when
    else tick(def, d.date);
  };
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
    return (
      <View key={def.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 4 }}>
        <Pressable onPress={() => (m ? undo(m) : reach(def))} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: !!m }} accessibilityLabel={def.label} style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2.5, borderColor: m ? meta.color : t.line, backgroundColor: m ? meta.color : "transparent", alignItems: "center", justifyContent: "center" }}>
            {m ? <Icon name="check" size={16} color="#fff" /> : null}
          </View>
        </Pressable>
        <Pressable onPress={() => (m ? edit(def) : undefined)} style={{ flex: 1, paddingVertical: 6, paddingRight: 6 }}>
          <Text style={{ color: t.ink, fontWeight: m ? "800" : "600", fontSize: 14.5, lineHeight: 19 }}>{def.label}</Text>
          {m ? <Text style={{ color: t.ink3, fontSize: 12, marginTop: 1 }}>{formatDate(m.date)}{m.description ? " · " + m.description : ""}</Text> : null}
        </Pressable>
        {m ? (
          <Pressable onPress={() => edit(def)} hitSlop={8} accessibilityLabel={`Edit ${def.label}`} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: areaSoft(meta, t), alignItems: "center", justifyContent: "center" }}>
            <Icon name="edit-2" size={15} color={meta.color} />
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
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.gold, alignItems: "center", justifyContent: "center" }}><Icon name="star" size={22} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.titleLarge, { color: t.ink }]}>{celebration(reached, child.name).title}</Text>
          <Text style={{ color: t.ink2, fontSize: 12.5, marginTop: 1 }}>{celebration(reached, child.name).sub}</Text>
        </View>
      </View>

      <View style={{ marginTop: 14 }}>
        <Seg options={[{ id: "earlier" as View3, label: "Earlier" }, { id: "now" as View3, label: `Now · ${ageChip(months)}` }, { id: "next" as View3, label: "Coming up" }]} value={view} onChange={setView} />
      </View>

      {suggestions.length ? (
        <View style={{ backgroundColor: t.card, borderRadius: 20, borderWidth: 1, borderColor: t.line, padding: 14, marginTop: 14 }}>
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15 }}>Is this happening? 👀</Text>
          <Text style={{ color: t.ink3, fontSize: 12.5, marginTop: 2, marginBottom: 6 }}>Tap Yes if you've seen it. No pressure either way.</Text>
          {suggestions.map((d) => (
            <View key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, borderTopWidth: 1, borderTopColor: t.line }}>
              <Text style={{ fontSize: 22 }}>{d.emoji}</Text>
              <Text style={{ flex: 1, color: t.ink, fontWeight: "700", fontSize: 14 }}>{d.label}</Text>
              <Pressable onPress={() => reach(d)} style={{ backgroundColor: AREA_META[areaOf(d)].color, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8 }}><Text style={{ color: "#fff", fontWeight: "700", fontSize: 12.5 }}>Yes!</Text></Pressable>
              <Pressable onPress={() => answerNotYet(child.id, d.id, today)} style={{ backgroundColor: t.bg2, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8 }}><Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12.5 }}>Not yet</Text></Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {view === "now" && beyond ? (
        <Text style={{ color: t.ink3, textAlign: "center", padding: 24, lineHeight: 20 }}>{child.name} has grown past the 0–36 month chart 🎓{"\n"}Everything you ticked is under Earlier, and you can add your own milestones below.</Text>
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
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: meta.color, alignItems: "center", justifyContent: "center" }}><Icon name={meta.icon as IconName} size={18} color="#fff" /></View>
              <Text style={{ flex: 1, color: t.ink, fontWeight: "700", fontSize: 16 }}>{meta.label}</Text>
              {done >= 2 ? <Text style={{ color: meta.color, fontWeight: "700", fontSize: 12.5 }}>{done} reached</Text> : done === 1 ? <Icon name="star" size={15} color={meta.color} /> : null}
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
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15, marginBottom: 4 }}>⭐ Your other milestones</Text>
          {others.map((m) => {
            const meta = AREA_META[areaOf([...MILESTONE_DEFS, ...custom].find((d) => d.id === m.milestoneId) ?? {})];
            return (
              <Pressable key={m.id} onPress={() => m.milestoneId && setEntrySheet({ kind: "milestone", editId: m.milestoneId })} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: meta.color, alignItems: "center", justifyContent: "center" }}><Icon name="check" size={16} color="#fff" /></View>
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

      <Btn label="＋ Add a milestone of your own" kind="line" onPress={() => setEntrySheet({ kind: "milestone" })} style={{ marginTop: 16 }} />

      {asking ? <DatePrompt def={asking} birth={child.birth} onPick={(date) => { const d = asking; setAsking(null); tick(d, date); }} onClose={() => setAsking(null)} /> : null}
    </View>
  );
}

/** "When did this happen?" — only asked when a milestone from a much earlier stage is ticked. */
function DatePrompt({ def, birth, onPick, onClose }: { def: MilestoneDef; birth: string; onPick: (date: string) => void; onClose: () => void }) {
  const t = useTheme();
  const today = todayISO();
  const d = defaultMilestoneDate(def, birth, today);
  const [custom, setCustom] = useState(false);
  const [date, setDate] = useState(d.date);
  return (
    <Sheet visible onClose={onClose} title="When did this happen?">
      <Text style={{ color: t.ink, fontWeight: "700", fontSize: 16 }}>{def.emoji} {def.label}</Text>
      <Text style={{ color: t.ink3, fontSize: 13, lineHeight: 19, marginTop: 4 }}>This is usually seen earlier, so pick roughly when it happened. You can change it any time with the pencil.</Text>
      {!custom ? (
        <View style={{ gap: 10, marginTop: 16 }}>
          {d.aroundMonths !== undefined ? <Btn label={`Around ${d.aroundMonths} months old`} onPress={() => onPick(addMonths(birth, d.aroundMonths as number))} /> : null}
          <Btn label="Today" kind="line" onPress={() => onPick(today)} />
          <Btn label="Pick a date…" kind="soft" onPress={() => setCustom(true)} />
        </View>
      ) : (
        <View style={{ marginTop: 14 }}>
          <DateField value={date} onChange={setDate} min={birth} max={today} />
          <Btn label="Save" onPress={() => onPick(date)} style={{ marginTop: 14 }} />
        </View>
      )}
    </Sheet>
  );
}
