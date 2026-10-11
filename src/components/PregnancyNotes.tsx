import React, { useMemo, useState } from "react";
import { Alert, Linking, Pressable, Text, View } from "react-native";
import { Child, Memory } from "../lib/types";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { byMoment } from "../lib/display";
import { formatDate, todayISO } from "../lib/date";
import { weekOn } from "../lib/pregnancy";
import {
  CRAVING_IDEAS, CRAVING_NOTE, CRAVING_SOURCE, FOODS_TO_AVOID_URL, LEGACY_SOURCE, OTHER_SYMPTOM_NOTE, SYMPTOMS, SYMPTOM_DISCLAIMER, SYMPTOM_SOURCE,
  SymptomGuide, legacyIsCraving, symptomForTitle,
} from "../lib/symptoms";
import { TYPE } from "../theme";
import { Btn, DateField, Input, Seg, Sheet } from "./ui";
import { Icon } from "./Icon";

export type NoteKind = "symptom" | "craving";

/** A symptom's days: "5 Mar 2026 – 2 Apr 2026", "Since 5 Mar 2026" while it's still going, or one day. */
export function noteDays(m: Pick<Memory, "date" | "endDate">, ongoing: boolean): string {
  if (m.endDate && m.endDate !== m.date) return `${formatDate(m.date)} – ${formatDate(m.endDate)}`;
  return ongoing ? `Since ${formatDate(m.date)}` : formatDate(m.date);
}

/** Which kind a note is (older notes were kept together under one source). */
export const kindOf = (m: Memory): NoteKind | null =>
  m.source === SYMPTOM_SOURCE ? "symptom" : m.source === CRAVING_SOURCE ? "craving" : m.source === LEGACY_SOURCE && m.type === "story" ? (legacyIsCraving(m.title) ? "craving" : "symptom") : null;

/**
 * Symptoms or cravings in a pregnancy, laid out like Firsts and Lasts: the common ones to tap, "Something else", and the ones noted so far.
 * A symptom has a stretch of days (from, to, or still going) and comes with a few NHS-based tips; a craving is one day.
 */
export function PregnancyNotes({ child, kind }: { child: Child; kind: NoteKind }) {
  const t = useTheme();
  const memories = useStore((s) => s.memories);
  const [open, setOpen] = useState<{ title: string; edit?: Memory } | null>(null);
  const viewOnly = child.role === "viewer";
  const notes = useMemo(() => memories.filter((m) => m.childId === child.id && kindOf(m) === kind).sort((a, b) => byMoment(b, a)), [memories, child.id, kind]);
  const symptom = kind === "symptom";
  const chip = (label: string, emoji: string | undefined, onPress: () => void, accent = false) => (
    <Pressable key={label} onPress={onPress} accessibilityRole="button"
      style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, backgroundColor: accent ? "transparent" : t.accentSoft, borderWidth: accent ? 1 : 0, borderColor: t.accent }}>
      {emoji ? <Text style={{ fontSize: 14 }}>{emoji}</Text> : null}
      <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12.5 }}>{label}</Text>
    </Pressable>
  );

  return (
    <View>
      <Text style={[TYPE.bodyMedium, { color: t.ink3, marginBottom: 12 }]}>
        {symptom ? "The hard parts too, and how long they lasted. Tap one for a few tips that can help." : "The midnight snacks and the smells you couldn't stand, to laugh about later."}
      </Text>
      {!viewOnly ? (
        <>
          <Btn label={symptom ? "Add a symptom" : "Add a craving"} icon="plus" onPress={() => setOpen({ title: "" })} />
          <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12, marginTop: 14, marginBottom: 6 }}>{symptom ? "Common symptoms" : "Ideas"}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {symptom ? SYMPTOMS.map((s) => chip(s.label, s.emoji, () => setOpen({ title: s.label }))) : CRAVING_IDEAS.map((c) => chip(c, undefined, () => setOpen({ title: c.endsWith("…") ? c.slice(0, -1) : c })))}
            {chip("Something else", undefined, () => setOpen({ title: "" }), true)}
          </View>
        </>
      ) : null}
      {!symptom ? (
        <Pressable onPress={() => Linking.openURL(FOODS_TO_AVOID_URL)} style={{ marginTop: 12 }}>
          <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{CRAVING_NOTE} <Text style={{ color: t.accentDeep, fontWeight: "700" }}>Foods to avoid (NHS)</Text></Text>
        </Pressable>
      ) : null}

      {notes.length ? (
        <View style={{ marginTop: 16, gap: 8 }}>
          {notes.map((m) => {
            const guide = symptom ? symptomForTitle(m.title) : undefined;
            return (
              <Pressable key={m.id} onPress={() => !viewOnly && setOpen({ title: m.title ?? "", edit: m })} accessibilityRole="button"
                style={{ flexDirection: "row", gap: 12, backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.line, padding: 12 }}>
                <Text style={{ fontSize: 24 }}>{guide?.emoji ?? m.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[TYPE.titleSmall, { color: t.ink }]}>{m.title}</Text>
                  <Text style={[TYPE.labelMedium, { color: t.accentDeep, marginTop: 2 }]}>{noteDays(m, symptom && !m.endDate)} · week {weekOn(child.birth, m.date)}</Text>
                  {m.description ? <Text style={[TYPE.bodySmall, { color: t.ink2, marginTop: 4 }]} numberOfLines={3}>{m.description}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {open ? <NoteSheet child={child} kind={kind} start={open.title} edit={open.edit} onClose={() => setOpen(null)} /> : null}
    </View>
  );
}

/** The tips for a symptom: what can help, when to call, when to get help straight away, the NHS page, and the disclaimer. */
function Tips({ guide }: { guide: SymptomGuide }) {
  const t = useTheme();
  const list = (items: string[], color: string) => items.map((x) => (
    <View key={x} style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
      <Text style={{ color, fontWeight: "700" }}>•</Text>
      <Text style={[TYPE.bodySmall, { color: t.ink2, flex: 1 }]}>{x}</Text>
    </View>
  ));
  return (
    <View style={{ backgroundColor: t.bg2, borderRadius: 16, padding: 14, marginTop: 14 }}>
      <Text style={[TYPE.titleSmall, { color: t.ink }]}>What can help</Text>
      {list(guide.tips, t.accentDeep)}
      {guide.callIf?.length ? (
        <>
          <Text style={[TYPE.titleSmall, { color: t.ink, marginTop: 12 }]}>Give your midwife or GP a ring if</Text>
          {list(guide.callIf, t.accentDeep)}
        </>
      ) : null}
      {guide.urgentIf?.length ? (
        <View style={{ borderLeftWidth: 3, borderLeftColor: t.danger, paddingLeft: 10, marginTop: 12 }}>
          <Text style={[TYPE.titleSmall, { color: t.danger }]}>Get help straight away if you have</Text>
          {list(guide.urgentIf, t.danger)}
          <Text style={[TYPE.bodySmall, { color: t.ink2, marginTop: 4 }]}>Call your maternity unit, midwife or doctor. In an emergency, call your local emergency number.</Text>
        </View>
      ) : null}
      <Pressable onPress={() => Linking.openURL(guide.source)} hitSlop={6} style={{ marginTop: 12 }}>
        <Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>Read more on the NHS website</Text>
      </Pressable>
      <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 10, fontSize: 11.5, lineHeight: 16 }]}>{SYMPTOM_DISCLAIMER}</Text>
    </View>
  );
}

/** Note a symptom (with how long it lasted, and the tips) or a craving. The tips are only shown here: they aren't saved, so they never go into the book. */
function NoteSheet({ child, kind, start, edit, onClose }: { child: Child; kind: NoteKind; start: string; edit?: Memory; onClose: () => void }) {
  const t = useTheme();
  const saveMemory = useStore((s) => s.saveMemory);
  const removeMemory = useStore((s) => s.removeMemory);
  const today = todayISO();
  const symptom = kind === "symptom";
  const [title, setTitle] = useState(edit?.title ?? start);
  const [text, setText] = useState(edit?.description ?? "");
  const [from, setFrom] = useState(edit?.date ?? today);
  const [ongoing, setOngoing] = useState<"on" | "ended">(edit ? (edit.endDate ? "ended" : "on") : "on");
  const [to, setTo] = useState(edit?.endDate ?? today);
  const [showTips, setShowTips] = useState(!edit);
  const guide = symptom ? symptomForTitle(title) : undefined;
  const custom = symptom && !!title.trim() && !guide;

  const save = () => {
    const end = symptom && ongoing === "ended" ? (to < from ? from : to) : undefined;
    saveMemory({
      id: edit?.id, childId: child.id, type: "story", title: title.trim(), description: text, date: from, endDate: end,
      media: edit?.media ?? [], tagIds: edit?.tagIds ?? [], emoji: guide?.emoji ?? (symptom ? "🤰" : "😋"), source: symptom ? SYMPTOM_SOURCE : CRAVING_SOURCE,
    });
    onClose();
  };
  const remove = () => edit && Alert.alert("Delete this note?", edit.title ?? "", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => { removeMemory(edit.id); onClose(); } }]);

  return (
    <Sheet visible onClose={onClose} title={symptom ? (edit ? "Symptom" : "Add a symptom") : edit ? "Craving" : "Add a craving"}>
      <Input value={title} onChangeText={setTitle} placeholder={symptom ? "What was it? Example: Heartburn" : "Example: Pickles at midnight"} />
      {symptom ? (
        <>
          <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 14, marginBottom: 6 }]}>Started</Text>
          <DateField value={from} onChange={setFrom} max={today} />
          <View style={{ marginTop: 12 }}>
            <Seg options={[{ id: "on" as const, label: "Still going" }, { id: "ended" as const, label: "It stopped" }]} value={ongoing} onChange={setOngoing} />
          </View>
          {ongoing === "ended" ? (
            <>
              <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 12, marginBottom: 6 }]}>Stopped</Text>
              <DateField value={to < from ? from : to} onChange={setTo} min={from} max={today} />
            </>
          ) : null}
          <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 6 }]}>From week {weekOn(child.birth, from)}{ongoing === "ended" ? ` to week ${weekOn(child.birth, to < from ? from : to)}` : ""}</Text>
        </>
      ) : (
        <>
          <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 14, marginBottom: 6 }]}>When</Text>
          <DateField value={from} onChange={setFrom} max={today} />
        </>
      )}
      <Input value={text} onChangeText={setText} placeholder="A few words, to remember it by (optional)" multiline style={{ marginTop: 12, minHeight: 70, textAlignVertical: "top" }} />

      {guide ? (
        <>
          <Pressable onPress={() => setShowTips((v) => !v)} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 }}>
            <Icon name="health" size={18} color={t.accentDeep} />
            <Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>{showTips ? "Hide the tips" : "Tips that can help"}</Text>
          </Pressable>
          {showTips ? <Tips guide={guide} /> : null}
        </>
      ) : null}
      {custom ? (
        <View style={{ backgroundColor: t.bg2, borderRadius: 16, padding: 14, marginTop: 14 }}>
          <Text style={[TYPE.bodySmall, { color: t.ink2, lineHeight: 19 }]}>{OTHER_SYMPTOM_NOTE}</Text>
        </View>
      ) : null}

      <Btn label="Save" disabled={!title.trim()} onPress={save} style={{ marginTop: 16 }} />
      {edit ? <Btn label="Delete" kind="line" onPress={remove} style={{ marginTop: 10 }} /> : null}
      {guide || custom ? <Text style={[TYPE.bodySmall, { color: t.ink4, marginTop: 10, textAlign: "center" }]}>The tips stay here: they aren't saved with your note or put in the book.</Text> : null}
    </Sheet>
  );
}
