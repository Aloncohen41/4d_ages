import React, { useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Child, Memory, MILESTONE_DEFS } from "../lib/types";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { FRUIT_WEEKS, PREGNANCY_MILESTONES, SYMPTOM_IDEAS, SYMPTOM_SOURCE, TRIMESTER_NAMES, pregnancyWeekOf, sizeForWeek, trimesterOf, weekOn } from "../lib/pregnancy";
import { formatDate, parseISO, pregnancy, toISO, todayISO } from "../lib/date";
import { logMilestone } from "../lib/saveMilestone";
import { pickMedia, toMediaItems } from "../lib/media";
import { byMoment } from "../lib/display";
import { parseNumber } from "../lib/entries";
import { TYPE } from "../theme";
import { Btn, DateField, Input, PhotoView, Sheet } from "./ui";
import { Icon } from "./Icon";

/** "about 25.6 cm and 300 g" */
const sizeText = (cm: number, g?: number) => `about ${cm < 1 ? `${Math.round(cm * 10)} mm` : `${cm} cm`}${g ? ` and ${g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${g} g`}` : ""}`;

/**
 * Growth before birth: this week of the pregnancy, with how big the baby is (as a fruit, with a typical length and weight), the whole scale
 * week by week, the ultrasound pictures, and the measurements from scans (compared with what's typical for that week).
 */
export function PregnancyGrowth({ child }: { child: Child }) {
  const t = useTheme();
  const memories = useStore((s) => s.memories);
  const saveMemory = useStore((s) => s.saveMemory);
  const setPhotoEdit = useStore((s) => s.setPhotoEdit);
  const removeMemory = useStore((s) => s.removeMemory);
  const today = todayISO();
  const now = pregnancy(child.birth, today);
  const [shown, setShown] = useState(Math.min(40, Math.max(4, now.week)));
  const [measuring, setMeasuring] = useState(false);
  const scale = useRef<ScrollView>(null);
  const size = sizeForWeek(shown);
  const scans = useMemo(() => memories.filter((m) => m.childId === child.id && m.source === "Ultrasound").sort((a, b) => byMoment(b, a)), [memories, child.id]);
  const measures = useMemo(() => memories.filter((m) => m.childId === child.id && m.type === "measure" && m.source === "Scan").sort((a, b) => byMoment(b, a)), [memories, child.id]);
  const viewOnly = child.role === "viewer";

  const addScan = async () => {
    const picked = await pickMedia({ videos: true, multiple: false });
    if (!picked.length) return;
    const date = picked[0].dated && picked[0].date <= today ? picked[0].date : today;
    const id = saveMemory({ childId: child.id, type: "photo", title: `Ultrasound, week ${weekOn(child.birth, date)}`, description: "", date, media: toMediaItems(picked), tagIds: [], emoji: "🩻", source: "Ultrasound" });
    setTimeout(() => setPhotoEdit(id), 250); // add a few words, or fix the date
  };

  return (
    <View>
      {/* this week */}
      <View style={{ backgroundColor: t.card, borderRadius: 22, borderWidth: 1, borderColor: t.line, padding: 18, marginTop: 14, alignItems: "center" }}>
        <Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>{shown === now.week ? `Week ${now.week} of 40 · ${TRIMESTER_NAMES[trimesterOf(now.week)]}` : `Week ${shown}`}</Text>
        <Text style={{ fontSize: 72, marginVertical: 6 }}>{size.emoji}</Text>
        <Text style={[TYPE.titleLarge, { color: t.ink, textAlign: "center" }]}>The size of {size.fruit}</Text>
        <Text style={[TYPE.bodyMedium, { color: t.ink3, marginTop: 2 }]}>{sizeText(size.cm, size.g)}</Text>
        {shown === now.week ? (
          <>
            <View style={{ alignSelf: "stretch", height: 8, borderRadius: 4, backgroundColor: t.bg2, marginTop: 14, overflow: "hidden" }}>
              <View style={{ width: `${Math.min(100, (now.week / 40) * 100)}%`, height: 8, backgroundColor: t.accent }} />
            </View>
            <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 6 }]}>Due {formatDate(child.birth)} · {now.weeksToGo} week{now.weeksToGo === 1 ? "" : "s"} to go</Text>
          </>
        ) : (
          <Pressable onPress={() => setShown(Math.min(40, Math.max(4, now.week)))} hitSlop={6} style={{ marginTop: 10 }}><Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>Back to this week</Text></Pressable>
        )}
      </View>

      {/* the scale, week by week */}
      <Text style={[TYPE.titleMedium, { color: t.ink, marginTop: 20, marginBottom: 8 }]}>Week by week</Text>
      <ScrollView ref={scale} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
        onLayout={() => scale.current?.scrollTo({ x: Math.max(0, (now.week - 6) * 72), animated: false })}>
        {FRUIT_WEEKS.map((w) => {
          const on = w.week === shown;
          const isNow = w.week === now.week;
          return (
            <Pressable key={w.week} onPress={() => setShown(w.week)} accessibilityRole="button" accessibilityLabel={`Week ${w.week}: ${w.fruit}`}
              style={{ width: 64, alignItems: "center", paddingVertical: 8, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? t.accent : t.line, backgroundColor: isNow ? t.accentSoft : t.card }}>
              <Text style={{ fontSize: 26 }}>{w.emoji}</Text>
              <Text style={[TYPE.labelMedium, { color: isNow ? t.onAccentSoft : t.ink2 }]}>Week {w.week}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ultrasound pictures */}
      <Text style={[TYPE.titleMedium, { color: t.ink, marginTop: 20, marginBottom: 8 }]}>Ultrasound pictures</Text>
      {!viewOnly ? <Btn label="Add an ultrasound picture" icon="image" onPress={addScan} /> : null}
      {scans.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          {scans.map((m) => (
            <Pressable key={m.id} onPress={() => !viewOnly && setPhotoEdit(m.id)} accessibilityRole="button" style={{ width: "31%" }}>
              <PhotoView photo={m} style={{ width: "100%", aspectRatio: 1, borderRadius: 12 }} emojiSize={28} />
              <Text style={[TYPE.labelMedium, { color: t.ink2, marginTop: 3 }]}>Week {weekOn(child.birth, m.date)}</Text>
            </Pressable>
          ))}
        </View>
      ) : <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 8 }]}>The scan pictures go here, and into the book before the birth.</Text>}

      {/* measurements from scans */}
      <Text style={[TYPE.titleMedium, { color: t.ink, marginTop: 20, marginBottom: 8 }]}>Measurements from scans</Text>
      {!viewOnly ? <Btn label="Add a scan measurement" icon="add-measure" kind="line" onPress={() => setMeasuring(true)} /> : null}
      {measures.map((m) => {
        const wk = weekOn(child.birth, m.date);
        const typical = sizeForWeek(wk);
        return (
          <Pressable key={m.id} onLongPress={() => !viewOnly && Alert.alert("Remove this measurement?", formatDate(m.date), [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => removeMemory(m.id) }])}
            style={{ backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.line, padding: 12, marginTop: 8 }}>
            <Text style={[TYPE.titleSmall, { color: t.ink }]}>Week {wk}: {[m.heightCm != null ? `${m.heightCm} cm` : "", m.weightKg != null ? `${Math.round(m.weightKg * 1000)} g` : ""].filter(Boolean).join(", ")}</Text>
            <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{formatDate(m.date)} · typical at week {wk}: {sizeText(typical.cm, typical.g)}</Text>
          </Pressable>
        );
      })}
      <Text style={[TYPE.bodySmall, { color: t.ink4, marginTop: 10 }]}>Sizes are typical averages; every baby grows in their own way. Ask your midwife or doctor about your scans.</Text>
      {measuring ? <ScanMeasureSheet child={child} onClose={() => setMeasuring(false)} /> : null}
    </View>
  );
}

/** A measurement from a scan: the estimated weight and length the sonographer gave. Kept apart from the growth charts after birth. */
function ScanMeasureSheet({ child, onClose }: { child: Child; onClose: () => void }) {
  const t = useTheme();
  const saveMemory = useStore((s) => s.saveMemory);
  const [date, setDate] = useState(todayISO());
  const [cm, setCm] = useState("");
  const [g, setG] = useState("");
  const [err, setErr] = useState("");
  const save = () => {
    const length = cm.trim() ? parseNumber(cm) : null;
    const weight = g.trim() ? parseNumber(g) : null;
    if (length == null && weight == null) return setErr("Enter the length, the weight, or both.");
    if (length != null && !(length > 0 && length < 60)) return setErr("That length doesn't look right. Enter it in cm.");
    if (weight != null && !(weight > 0 && weight < 6000)) return setErr("That weight doesn't look right. Enter it in grams.");
    saveMemory({ childId: child.id, type: "measure", title: `Scan, week ${weekOn(child.birth, date)}`, description: "", date, media: [], tagIds: [], emoji: "🩻", source: "Scan", heightCm: length ?? undefined, weightKg: weight != null ? weight / 1000 : undefined });
    onClose();
  };
  return (
    <Sheet visible onClose={onClose} title="Scan measurement">
      <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>The estimates from a scan: the baby's length and weight.</Text>
      <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 12, marginBottom: 6 }]}>Date of the scan</Text>
      <DateField value={date} onChange={setDate} max={todayISO()} />
      <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 4 }]}>Week {weekOn(child.birth, date)} of the pregnancy</Text>
      <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 12, marginBottom: 6 }]}>Length (cm)</Text>
      <Input value={cm} onChangeText={setCm} keyboardType="decimal-pad" placeholder="Example: 25.6" />
      <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 12, marginBottom: 6 }]}>Estimated weight (g)</Text>
      <Input value={g} onChangeText={setG} keyboardType="decimal-pad" placeholder="Example: 300" />
      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 10 }}>{err}</Text> : null}
      <Btn label="Save" onPress={save} style={{ marginTop: 16 }} />
    </Sheet>
  );
}

/**
 * Milestones before birth: the pregnancy milestones (the first scan, the heartbeat, the first kick…), ticked with today's date and changed
 * with a tap; and the symptoms and cravings, noted as they come (morning sickness, the odd craving, strange dreams…).
 */
export function PregnancyMilestones({ child }: { child: Child }) {
  const t = useTheme();
  const memories = useStore((s) => s.memories);
  const setEntrySheet = useStore((s) => s.setEntrySheet);
  const saveMemory = useStore((s) => s.saveMemory);
  const [noting, setNoting] = useState<string | null>(null);
  const today = todayISO();
  const viewOnly = child.role === "viewer";
  const logged = useMemo(() => new Map(memories.filter((m) => m.childId === child.id && m.type === "milestone" && m.milestoneId?.startsWith("preg-")).map((m) => [m.milestoneId as string, m])), [memories, child.id]);
  const notes = useMemo(() => memories.filter((m) => m.childId === child.id && m.source === SYMPTOM_SOURCE && m.type === "story").sort((a, b) => byMoment(b, a)), [memories, child.id]);
  const done = PREGNANCY_MILESTONES.filter((d) => logged.has(d.id)).length;

  const tick = (id: string) => {
    if (viewOnly) return;
    const m = logged.get(id);
    if (m) return setEntrySheet({ kind: "milestone", editId: id }); // change the date, add words or a picture
    const def = PREGNANCY_MILESTONES.find((d) => d.id === id)!;
    logMilestone({ childId: child.id, defId: def.id, title: def.label, emoji: def.emoji, date: today, tagIds: [], note: "", media: [] });
  };
  const pickDateFor = (m: Memory) =>
    DateTimePickerAndroid.open({ value: parseISO(m.date), mode: "date", maximumDate: new Date(), onChange: (e, d) => { if (e.type === "set" && d) saveMemory({ ...m, id: m.id, date: toISO(d) }); } });

  return (
    <View>
      <Text style={[TYPE.bodyMedium, { color: t.ink3, marginBottom: 10 }]}>{done} of {PREGNANCY_MILESTONES.length} · tap one to tick it with today's date, tap again to change it.</Text>
      {PREGNANCY_MILESTONES.map((d) => {
        const m = logged.get(d.id);
        return (
          <Pressable key={d.id} onPress={() => tick(d.id)} accessibilityRole="checkbox" accessibilityState={{ checked: !!m }} accessibilityLabel={d.label}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.line }}>
            <Icon name={m ? "check-square" : "square"} size={24} color={m ? t.accent : t.ink3} />
            <View style={{ flex: 1 }}>
              <Text style={[TYPE.bodyLarge, { color: t.ink }]}>{d.label}</Text>
              <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{m ? `Week ${weekOn(child.birth, m.date)} · ${formatDate(m.date)}` : `Usually around week ${pregnancyWeekOf(d)} · ${d.hint}`}</Text>
            </View>
            {m && !viewOnly ? <Pressable onPress={() => pickDateFor(m)} hitSlop={8} accessibilityLabel="Change the date"><Icon name="calendar" size={20} color={t.ink2} /></Pressable> : null}
          </Pressable>
        );
      })}

      <Text style={[TYPE.titleMedium, { color: t.ink, marginTop: 22 }]}>Symptoms and cravings</Text>
      <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 2, marginBottom: 8 }]}>The odd, funny and hard parts, to remember (or laugh about) later.</Text>
      {!viewOnly ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {SYMPTOM_IDEAS.map((s) => (
            <Pressable key={s} onPress={() => setNoting(s)} accessibilityRole="button" style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.card }}>
              <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12 }}>{s}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setNoting("")} accessibilityRole="button" style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: t.accent }}>
            <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12 }}>Something else</Text>
          </Pressable>
        </View>
      ) : null}
      {notes.map((m) => (
        <Pressable key={m.id} onPress={() => !viewOnly && setEntrySheet({ kind: "story", editId: m.id })} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.line }}>
          <Text style={[TYPE.titleSmall, { color: t.ink }]}>{m.title}</Text>
          {m.description ? <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>{m.description}</Text> : null}
          <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>Week {weekOn(child.birth, m.date)} · {formatDate(m.date)}</Text>
        </Pressable>
      ))}
      {noting !== null ? <SymptomSheet child={child} start={noting} onClose={() => setNoting(null)} /> : null}
    </View>
  );
}

/** Note a symptom or a craving: what it was, a few words, and the day. */
function SymptomSheet({ child, start, onClose }: { child: Child; start: string; onClose: () => void }) {
  const t = useTheme();
  const saveMemory = useStore((s) => s.saveMemory);
  const [title, setTitle] = useState(start);
  const [text, setText] = useState("");
  const [date, setDate] = useState(todayISO());
  return (
    <Sheet visible onClose={onClose} title="Symptoms and cravings">
      <Input value={title} onChangeText={setTitle} placeholder="Example: Craving pickles at midnight" />
      <Input value={text} onChangeText={setText} placeholder="A few words (optional)" multiline style={{ marginTop: 10, minHeight: 80, textAlignVertical: "top" }} />
      <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 12, marginBottom: 6 }]}>When</Text>
      <DateField value={date} onChange={setDate} max={todayISO()} />
      <Btn label="Save" disabled={!title.trim()} onPress={() => { saveMemory({ childId: child.id, type: "story", title: title.trim(), description: text, date, media: [], tagIds: [], emoji: "🤰", source: SYMPTOM_SOURCE }); onClose(); }} style={{ marginTop: 16 }} />
    </Sheet>
  );
}

/** Pregnancy milestone names for the rest of the app (posts, the book). */
export const PREGNANCY_DEF_IDS = new Set(MILESTONE_DEFS.filter((d) => d.category === "Pregnancy").map((d) => d.id));
