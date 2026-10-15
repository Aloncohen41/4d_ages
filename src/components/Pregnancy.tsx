import React, { useMemo, useRef, useState } from "react";
import { openDatePicker } from "../lib/datePicker";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Child, Memory, MILESTONE_DEFS } from "../lib/types";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { pregnancyLastDay, usualDay } from "../lib/pregnancy";
import { BORN_ID, BUMP_SOURCE, BUMP_TIPS, FRUIT_WEEKS, GENDER_REVEAL_ID, PREGNANCY_MILESTONES, PREGNANCY_NAME, TRIMESTER_NAMES, milestonesByTrimester, pregnancyWeekOf, sizeForWeek, trimesterOf, weekOn } from "../lib/pregnancy";
import { buildBumpReel } from "../lib/reels";
import { Gender } from "../lib/types";
import { addDays, formatDate, parseISO, pregnancy, toISO, todayISO } from "../lib/date";
import { logMilestone } from "../lib/saveMilestone";
import { pickMedia, toMediaItems } from "../lib/media";
import { byMoment } from "../lib/display";
import { parseNumber } from "../lib/entries";
import { TYPE } from "../theme";
import { Btn, DateField, Input, PhotoView, Seg, Sheet } from "./ui";
import { Icon } from "./Icon";
import { GrowPlayer } from "./Grow";
import { Image } from "expo-image";
import { FRUIT_PICTURES } from "../lib/fruitPictures";

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
  const past = !child.expecting; // looking back on a pregnancy, after the birth
  const today = pregnancyLastDay(child, todayISO());
  const now = past ? { week: 40, weeksToGo: 0, daysToGo: 0 } : pregnancy(child.birth, today);
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
      {/* this week (looking back: any week, picked from the scale) */}
      <View style={{ backgroundColor: t.card, borderRadius: 22, borderWidth: 1, borderColor: t.line, padding: 18, marginTop: 14, alignItems: "center" }}>
        <Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>{shown === now.week ? `Week ${now.week} of 40 · ${TRIMESTER_NAMES[trimesterOf(now.week)]}` : `Week ${shown}`}</Text>
        <Image source={FRUIT_PICTURES[size.pic]} accessibilityLabel={size.fruit} style={{ width: 132, height: 132, borderRadius: 28, marginVertical: 10 }} contentFit="cover" transition={150} />
        <Text style={[TYPE.titleLarge, { color: t.ink, textAlign: "center" }]}>The size of {size.fruit}</Text>
        <Text style={[TYPE.bodyMedium, { color: t.ink3, marginTop: 2 }]}>{sizeText(size.cm, size.g)}</Text>
        {past ? null : shown === now.week ? (
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

      <BumpPhotos child={child} />

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
              <Image source={FRUIT_PICTURES[w.pic]} style={{ width: 44, height: 44, borderRadius: 10, marginBottom: 4 }} contentFit="cover" />
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
  const last = pregnancyLastDay(child, todayISO());
  const t = useTheme();
  const saveMemory = useStore((s) => s.saveMemory);
  const [date, setDate] = useState(last);
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
      <DateField value={date} onChange={setDate} max={last} />
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
 * Milestones before birth, by trimester: the pregnancy milestones (the first scan, the heartbeat, the gender reveal, the first kick…), ticked
 * with today's date and changed with a tap; then "Welcome to the world", which sets the birthday and starts the child's own profile.
 * (Symptoms and cravings have their own sections: see PregnancyNotes.tsx.)
 */
export function PregnancyMilestones({ child }: { child: Child }) {
  const t = useTheme();
  const memories = useStore((s) => s.memories);
  const setEntrySheet = useStore((s) => s.setEntrySheet);
  const saveMemory = useStore((s) => s.saveMemory);
  const [revealing, setRevealing] = useState(false);
  const [arriving, setArriving] = useState(false);
  const past = !child.expecting;
  const today = pregnancyLastDay(child, todayISO());
  const viewOnly = child.role === "viewer";
  const logged = useMemo(() => new Map(memories.filter((m) => m.childId === child.id && m.type === "milestone" && m.milestoneId?.startsWith("preg-")).map((m) => [m.milestoneId as string, m])), [memories, child.id]);
  const done = PREGNANCY_MILESTONES.filter((d) => logged.has(d.id)).length;
  const nowTrimester = trimesterOf(pregnancy(child.birth, today).week);

  const tick = (id: string) => {
    if (viewOnly) return;
    if (id === GENDER_REVEAL_ID) return setRevealing(true); // the date, and girl or boy
    const m = logged.get(id);
    if (m) return setEntrySheet({ kind: "milestone", editId: id }); // change the date, add words or a picture
    const def = PREGNANCY_MILESTONES.find((d) => d.id === id)!;
    // looking back: the week it usually happens (changed with the calendar button); otherwise today
    const date = past ? (usualDay(child.birth, pregnancyWeekOf(def) ?? 20) < today ? usualDay(child.birth, pregnancyWeekOf(def) ?? 20) : today) : today;
    logMilestone({ childId: child.id, defId: def.id, title: def.label, emoji: def.emoji, date, tagIds: [], note: "", media: [] });
  };
  const pickDateFor = (m: Memory) =>
    openDatePicker({ value: parseISO(m.date), mode: "date", maximumDate: parseISO(today), onChange: (e, d) => { if (e.type === "set" && d) saveMemory({ ...m, id: m.id, date: toISO(d) }); } });

  return (
    <View>
      <Text style={[TYPE.bodyMedium, { color: t.ink3, marginBottom: 4 }]}>{done} of {PREGNANCY_MILESTONES.length} · {past ? "tap one to tick it (it's dated to the week it usually happens; the calendar changes it)" : "tap one to tick it with today's date, tap again to change it"}.</Text>
      {milestonesByTrimester().map((tri) => (
        <View key={tri.trimester}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, marginBottom: 2 }}>
            <Text style={[TYPE.titleMedium, { color: t.ink }]}>{tri.name}</Text>
            <Text style={[TYPE.labelMedium, { color: t.ink3 }]}>{tri.trimester === 1 ? "weeks 1 to 13" : tri.trimester === 2 ? "weeks 14 to 27" : "weeks 28 to 40"}</Text>
            {tri.trimester === nowTrimester ? <Text style={{ backgroundColor: t.accentSoft, color: t.onAccentSoft, fontWeight: "700", fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, overflow: "hidden" }}>Now</Text> : null}
          </View>
          {tri.defs.map((d) => {
            const m = logged.get(d.id);
            const reveal = d.id === GENDER_REVEAL_ID;
            const sub = m
              ? `Week ${weekOn(child.birth, m.date)} · ${formatDate(m.date)}${reveal && m.description ? ` · ${m.description.split("\n")[0]}` : ""}`
              : `Usually around week ${pregnancyWeekOf(d)} · ${d.hint}`;
            return (
              <Pressable key={d.id} onPress={() => tick(d.id)} accessibilityRole="checkbox" aria-checked={!!m} accessibilityLabel={d.label}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.line }}>
                <Icon name={m ? "check-square" : "square"} size={24} color={m ? t.accent : t.ink3} />
                <View style={{ flex: 1 }}>
                  <Text style={[TYPE.bodyLarge, { color: t.ink }]}>{d.emoji} {d.label}</Text>
                  <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{sub}</Text>
                </View>
                {m && !viewOnly && !reveal ? <Pressable onPress={() => pickDateFor(m)} hitSlop={8} accessibilityLabel="Change the date"><Icon name="calendar" size={20} color={t.ink2} /></Pressable> : null}
              </Pressable>
            );
          })}
        </View>
      ))}

      {/* the last milestone: the birth (not when looking back: they're here) */}
      {!past ? <View style={{ backgroundColor: t.accentSoft, borderRadius: 20, padding: 16, marginTop: 18 }}>
        <Text style={[TYPE.titleMedium, { color: t.onAccentSoft }]}>👶 Welcome to the world</Text>
        <Text style={[TYPE.bodySmall, { color: t.onAccentSoft, marginTop: 4 }]}>When {child.name === PREGNANCY_NAME ? "the baby arrives" : `${child.name} arrives`}, set the birth date and the name. This becomes their own profile, with the pregnancy kept before the birth.</Text>
        {!viewOnly ? <Btn label="The baby is here!" icon="birthday" onPress={() => setArriving(true)} style={{ marginTop: 10 }} /> : null}
      </View> : null}

      {revealing ? <GenderRevealSheet child={child} memory={logged.get(GENDER_REVEAL_ID)} onClose={() => setRevealing(false)} /> : null}
      {arriving ? <ArrivalSheet child={child} onClose={() => setArriving(false)} /> : null}
    </View>
  );
}

const REVEAL_HEADLINES: Record<"girl" | "boy" | "surprise", string> = { girl: "It's a girl! 💗", boy: "It's a boy! 💙", surprise: "Keeping it a surprise 🎁" };

/**
 * The gender reveal: the day you found out, and a girl or a boy (or keeping it a surprise). It ticks the milestone and sets the child's gender
 * (used for the growth charts after the birth, and "sister" or "brother" for their siblings).
 */
export function GenderRevealSheet({ child, memory, onClose }: { child: Child; memory?: Memory; onClose: () => void }) {
  const t = useTheme();
  const updateChild = useStore((s) => s.updateChild);
  const removeMemory = useStore((s) => s.removeMemory);
  const setEntrySheet = useStore((s) => s.setEntrySheet);
  const first = memory?.description.split("\n")[0] ?? "";
  const was = (Object.keys(REVEAL_HEADLINES) as (keyof typeof REVEAL_HEADLINES)[]).find((k) => REVEAL_HEADLINES[k] === first);
  const [choice, setChoice] = useState<"girl" | "boy" | "surprise">(was ?? (child.gender === "boy" ? "boy" : "girl"));
  const last = pregnancyLastDay(child, todayISO());
  const [date, setDate] = useState(memory?.date ?? last);
  const [note, setNote] = useState(was ? (memory?.description ?? "").split("\n").slice(1).join("\n").trim() : memory?.description ?? "");
  const save = () => {
    const def = PREGNANCY_MILESTONES.find((d) => d.id === GENDER_REVEAL_ID)!;
    const description = REVEAL_HEADLINES[choice] + (note.trim() ? `\n${note.trim()}` : "");
    logMilestone({ childId: child.id, defId: def.id, title: def.label, emoji: choice === "girl" ? "💗" : choice === "boy" ? "💙" : "🎁", date, tagIds: memory?.tagIds ?? [], note: description, media: memory?.media ?? [] });
    updateChild(child.id, { gender: (choice === "surprise" ? "unspecified" : choice) as Gender });
    onClose();
  };
  return (
    <Sheet visible onClose={onClose} title="Gender reveal">
      <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>The day you found out. It also sets {child.name === PREGNANCY_NAME ? "the baby's" : `${child.name}'s`} gender in the profile.</Text>
      <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 14, marginBottom: 6 }]}>It's…</Text>
      <Seg options={[{ id: "girl" as const, label: "A girl" }, { id: "boy" as const, label: "A boy" }, { id: "surprise" as const, label: "A surprise" }]} value={choice} onChange={setChoice} />
      <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 14, marginBottom: 6 }]}>When you found out</Text>
      <DateField value={date} onChange={setDate} max={last} />
      <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 4 }]}>Week {weekOn(child.birth, date)} of the pregnancy</Text>
      <Input value={note} onChangeText={setNote} placeholder="How you found out: a cake, balloons, the scan… (optional)" multiline style={{ marginTop: 12, minHeight: 70, textAlignVertical: "top" }} />
      <Btn label="Save" onPress={save} style={{ marginTop: 16 }} />
      {memory ? (
        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          <Btn label="Add a picture" icon="image" kind="soft" onPress={() => { onClose(); setTimeout(() => setEntrySheet({ kind: "milestone", editId: GENDER_REVEAL_ID }), 250); }} style={{ flex: 1 }} />
          <Btn label="Untick" kind="line" onPress={() => { removeMemory(memory.id); onClose(); }} style={{ flex: 1 }} />
        </View>
      ) : null}
    </Sheet>
  );
}

/**
 * The baby is here: the birth date (it replaces the due date), the name and the gender. It ticks "Welcome to the world" on that day and turns
 * the pregnancy into the child's own profile, with everything from the pregnancy kept before the birth.
 */
export function ArrivalSheet({ child, onClose }: { child: Child; onClose: () => void }) {
  const t = useTheme();
  const updateChild = useStore((s) => s.updateChild);
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [name, setName] = useState(child.name === PREGNANCY_NAME ? "" : child.name);
  const [gender, setGender] = useState<Gender>(child.gender ?? "unspecified");
  const celebrate = useStore((s) => s.celebrate);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const earliest = addDays(child.birth, -26 * 7); // a very early arrival (from week 14), kept generous
  const save = (thenTell: boolean) => {
    if (!name.trim()) return setErr("Add their name. You can change it any time.");
    if (date > today) return setErr("The birth date can't be in the future.");
    const def = PREGNANCY_MILESTONES.find((d) => d.id === BORN_ID)!;
    logMilestone({ childId: child.id, defId: def.id, title: def.label, emoji: def.emoji, date, tagIds: [], note: note.trim(), media: [] });
    updateChild(child.id, { name: name.trim(), birth: date, gender, expecting: undefined, emoji: child.emoji === "🤰" ? "👶" : child.emoji });
    onClose();
    // the whole birth story opens over the whole app (this sheet goes: the pregnancy pages close once the baby is here)
    if (thenTell) setTimeout(() => useStore.getState().setBirthStoryFor(child.id), 300);
    else celebrate(`Welcome to the world, ${name.trim()}!`);
  };
  return (
    <Sheet visible onClose={onClose} title="Welcome to the world">
      <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>Congratulations! Set the birth date and the name, and this becomes their own profile. The pregnancy posts stay, before the birth (the due date was {formatDate(child.birth)}).</Text>
      <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 14, marginBottom: 6 }]}>Birth date</Text>
      <DateField value={date} onChange={setDate} min={earliest} max={today} />
      <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 14, marginBottom: 6 }]}>Name</Text>
      <Input value={name} onChangeText={setName} placeholder="Their name" />
      <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 14, marginBottom: 6 }]}>Gender</Text>
      <Seg options={[{ id: "girl" as Gender, label: "Girl" }, { id: "boy" as Gender, label: "Boy" }, { id: "unspecified" as Gender, label: "Prefer not to say" }]} value={gender} onChange={setGender} />
      <Input value={note} onChangeText={setNote} placeholder="A few words about the day (optional)" multiline style={{ marginTop: 12, minHeight: 70, textAlignVertical: "top" }} />
      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 10 }}>{err}</Text> : null}
      <Pressable onPress={() => save(true)} accessibilityRole="button"
        style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.accentSoft, borderRadius: 16, padding: 14, marginTop: 12 }}>
        <Text style={{ fontSize: 26 }}>📖</Text>
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.titleSmall, { color: t.onAccentSoft }]}>Tell us the whole birth story</Text>
          <Text style={[TYPE.bodySmall, { color: t.onAccentSoft }]}>How it started, who was there, the moment you met. We'd love to hear it all.</Text>
        </View>
        <Icon name="chevron-right" size={22} color={t.onAccentSoft} />
      </Pressable>
      <Btn label="Save and start their profile" icon="birthday" onPress={() => save(false)} style={{ marginTop: 16 }} />
    </Sheet>
  );
}

/** The tips for a bump photo that lines up with the others, so they play as a video. */
export function BumpTips() {
  const t = useTheme();
  return (
    <View style={{ marginTop: 8 }}>
      {BUMP_TIPS.map((tip) => (
        <View key={tip} style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          <Text style={{ color: t.accentDeep, fontWeight: "700" }}>•</Text>
          <Text style={[TYPE.bodySmall, { color: t.ink2, flex: 1 }]}>{tip}</Text>
        </View>
      ))}
    </View>
  );
}

/** Add this week's bump photo (from the camera roll), titled "Bump, week 21". */
export function useAddBumpPhoto(child: Child) {
  const saveMemory = useStore((s) => s.saveMemory);
  return async () => {
    const picked = await pickMedia({ videos: false, multiple: false });
    if (!picked.length) return;
    const today = pregnancyLastDay(child, todayISO());
    const date = picked[0].dated && picked[0].date <= today ? picked[0].date : today;
    saveMemory({ childId: child.id, type: "photo", title: `Bump, week ${weekOn(child.birth, date)}`, description: "", date, media: toMediaItems(picked), tagIds: [], emoji: "🤰", source: BUMP_SOURCE });
  };
}

/**
 * The weekly bump photo, in Growth: this week's photo (or a button to add it), the tips for taking it the same way each time, every week's
 * photo so far, and the video of the bump growing once there are two.
 */
function BumpPhotos({ child }: { child: Child }) {
  const t = useTheme();
  const memories = useStore((s) => s.memories);
  const setPhotoEdit = useStore((s) => s.setPhotoEdit);
  const add = useAddBumpPhoto(child);
  const [tips, setTips] = useState(false);
  const [playing, setPlaying] = useState(false);
  const photos = useMemo(() => memories.filter((m) => m.childId === child.id && m.source === BUMP_SOURCE).sort(byMoment), [memories, child.id]);
  const reel = useMemo(() => buildBumpReel(photos, child, BUMP_SOURCE), [photos, child]);
  const past = !child.expecting;
  const week = pregnancy(child.birth).week;
  const thisWeek = photos.some((m) => weekOn(child.birth, m.date) === week);
  const viewOnly = child.role === "viewer";
  return (
    <View>
      <Text style={[TYPE.titleMedium, { color: t.ink, marginTop: 20, marginBottom: 4 }]}>The bump, week by week</Text>
      <Text style={[TYPE.bodySmall, { color: t.ink3, marginBottom: 8 }]}>A photo every week from the same spot. After the birth they play as a video of the bump growing.</Text>
      {!viewOnly ? <Btn label={past ? "Add bump photos" : thisWeek ? `Week ${week} is done · add another` : `Add the week ${week} bump photo`} icon="image" kind={thisWeek && !past ? "line" : "solid"} onPress={add} /> : null}
      <Pressable onPress={() => setTips((v) => !v)} hitSlop={6} style={{ marginTop: 8 }}><Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>{tips ? "Hide the tips" : "Tips for photos that line up"}</Text></Pressable>
      {tips ? <BumpTips /> : null}
      {photos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 10 }}>
          {photos.map((m) => (
            <Pressable key={m.id} onPress={() => !viewOnly && setPhotoEdit(m.id)} accessibilityRole="button" accessibilityLabel={m.title} style={{ width: 84 }}>
              <PhotoView photo={m} style={{ width: 84, height: 112, borderRadius: 12 }} emojiSize={28} />
              <Text style={[TYPE.labelMedium, { color: t.ink2, marginTop: 3 }]}>Week {weekOn(child.birth, m.date)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {reel ? <Btn label={`Play the bump video (${reel.slides.length} weeks)`} icon="play" kind="soft" onPress={() => setPlaying(true)} style={{ marginTop: 10 }} /> : null}
      {playing && reel ? (
        <Sheet visible onClose={() => setPlaying(false)} title="The bump, week by week">
          <GrowPlayer slides={reel.slides} child={child} title={reel.title} subtitle={reel.subtitle} fileLabel={reel.fileLabel} />
        </Sheet>
      ) : null}
    </View>
  );
}

/** Pregnancy milestone names for the rest of the app (posts, the book). */
export const PREGNANCY_DEF_IDS = new Set(MILESTONE_DEFS.filter((d) => d.category === "Pregnancy").map((d) => d.id));
