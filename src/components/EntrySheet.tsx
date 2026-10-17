import React, { useMemo, useState } from "react";
import { PET_HEALTH_KINDS } from "../lib/pets";
import { Alert, Pressable, Text, View } from "react-native";
import { useActiveChild, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { Child, EntryKind, HealthKind, MILESTONE_CATALOG, MILESTONE_CATEGORIES, MILESTONE_DEFS, MediaItem, isPet } from "../lib/types";
import { areaOf, memoryForDef } from "../lib/development";
import { KIND_META, parseNumber } from "../lib/entries";
import { milestonesLogged } from "../lib/selectors";
import { uniqueIds } from "../lib/tags";
import { logMilestone } from "../lib/saveMilestone";
import { addMonths, ageBetween, ageShort, todayISO } from "../lib/date";
import { fromCm, fromKg, toCm, toKg } from "../lib/growth";
import { deleteFile } from "../lib/media";
import { coverOf, filesOf } from "../lib/display";
import { FIRST_IDEAS, LAST_IDEAS, openIdeas } from "../lib/suggestions";
import { byAgeFit } from "../lib/milestones";
import { Icon } from "./Icon";
import { Btn, DateField, DeleteButton, Input, Label, Seg, Sheet, TimeField } from "./ui";
import { MediaEditor } from "./MediaEditor";
import { VoicePlayer, VoiceRecorderSheet } from "./Voice";
import { audioMedia, visualMedia } from "../lib/display";
import { EmojiPicker } from "./EmojiPicker";
import { TagPicker } from "./TagPicker";

import { tr } from "../lib/i18n";
const TITLE: Record<EntryKind, { label: string; placeholder: string; text: string; textPlaceholder: string }> = {
  story: { get label() { return tr("Title (optional)"); }, get placeholder() { return tr("Example: A day at the lake"); }, get text() { return tr("Your story"); }, textPlaceholder: "What happened? Who was there? How did it feel?" },
  milestone: { get label() { return tr("Milestone"); }, get placeholder() { return tr("Example: Rolls over"); }, get text() { return tr("Notes"); }, textPlaceholder: "How it happened, who saw it… (optional)" },
  measure: { get label() { return tr("Title (optional)"); }, get placeholder() { return tr("Example: 9-month check-up"); }, get text() { return tr("Note (optional)"); }, textPlaceholder: "Anything worth remembering about this measurement" },
  first: { get label() { return tr("What was the first?"); }, get placeholder() { return tr("Example: First bath, first snow…"); }, get text() { return tr("Description"); }, textPlaceholder: "Tell the story of the first time (optional)" },
  last: { get label() { return tr("What was the last?"); }, get placeholder() { return tr("Example: Last bottle, last nap in the cot…"); }, get text() { return tr("Description"); }, textPlaceholder: "Tell the story of the last time (optional)" },
  health: { get label() { return tr("What was it?"); }, get placeholder() { return tr("Example: 1-year check-up, MMR vaccine"); }, get text() { return tr("Notes"); }, textPlaceholder: "What the doctor said, how they felt, a dose… (optional)" },
};

/** The kinds of health entry, for the health log. */
export const HEALTH_KINDS: { id: HealthKind; label: string }[] = [
  { id: "checkup", get label() { return tr("Check-up"); } },
  { id: "vaccination", get label() { return tr("Vaccination"); } },
  { id: "illness", get label() { return tr("Illness"); } },
  { id: "medicine", get label() { return tr("Medicine"); } },
  { id: "other", get label() { return tr("Other"); } },
];

/** The earliest date a post can have: up to ten months before the birth (pregnancy photos and scans). */
export const earliestDate = (birth: string) => addMonths(birth, -10);

const round = (n: number, d: number) => Number(n.toFixed(d));

/** One form for every "+" option: story, milestone, measurement (height, weight, head), first and last. */
export function EntrySheet() {
  const sheet = useStore((s) => s.entrySheet);
  const setEntrySheet = useStore((s) => s.setEntrySheet);
  const child = useActiveChild();
  if (!sheet || !child) return null;
  return (
    <EntryForm
      key={`${child.id}:${sheet.kind}:${sheet.editId ?? "new"}:${sheet.title ?? ""}`}
      kind={sheet.kind}
      editId={sheet.editId}
      prefill={{ title: sheet.title, emoji: sheet.emoji, healthKind: sheet.healthKind, media: sheet.media, date: sheet.date }}
      child={child}
      onClose={() => setEntrySheet(null)}
    />
  );
}

function EntryForm({ kind, editId, prefill, child, onClose }: { kind: EntryKind; editId?: string; prefill: { title?: string; emoji?: string; healthKind?: HealthKind; media?: MediaItem[]; date?: string }; child: Child; onClose: () => void }) {
  const t = useTheme();
  const memories = useStore((s) => s.memories);
  const customDefs = useStore((s) => s.customDefs);
  const heightUnit = useStore((s) => s.heightUnit);
  const weightUnit = useStore((s) => s.weightUnit);
  const setHeightUnit = useStore((s) => s.setHeightUnit);
  const setWeightUnit = useStore((s) => s.setWeightUnit);
  const saveMemory = useStore((s) => s.saveMemory);
  const removeMemory = useStore((s) => s.removeMemory);
  const deleteCustomDef = useStore((s) => s.deleteCustomDef);

  const logged = useMemo(() => milestonesLogged(memories, child.id), [memories, child.id]);
  const defs = useMemo(() => [...MILESTONE_DEFS, ...(customDefs[child.id] || [])], [customDefs, child.id]); // anything that can be named
  const suggestable = useMemo(() => [...MILESTONE_CATALOG, ...(customDefs[child.id] || [])], [customDefs, child.id]); // what we suggest
  const age = ageBetween(child.birth, todayISO());
  const ageMonths = age.years * 12 + age.months;

  // for a milestone, the editId is the milestone in the catalogue; for everything else it is the memory's own id
  const editingDef = kind === "milestone" && editId ? defs.find((d) => d.id === editId) : undefined;
  const editing = kind === "milestone" ? (editingDef ? memoryForDef(editingDef, logged) : undefined) : editId ? memories.find((m) => m.id === editId) : undefined;
  const isEdit = !!editing;
  const meta = KIND_META[kind];
  const initialMedia: MediaItem[] = editing?.media ?? prefill.media ?? [];

  const [title, setTitle] = useState(editing?.title ?? editingDef?.label ?? prefill.title ?? "");
  const [text, setText] = useState(editing?.description ?? "");
  const [date, setDate] = useState(editing?.date ?? prefill.date ?? todayISO());
  const [dateTouched, setDateTouched] = useState(isEdit || !!prefill.date);
  const [time, setTime] = useState<string | undefined>(editing?.time);
  const [location, setLocation] = useState(editing?.location ?? "");
  const pet = isPet(child); // a pet: their own health kinds, and weight only
  const [healthKind, setHealthKind] = useState<HealthKind>(editing?.healthKind ?? prefill.healthKind ?? (pet ? "vet" : "checkup"));
  const [tags, setTags] = useState<string[]>(editing?.tagIds ?? []);
  const [media, setMedia] = useState<MediaItem[]>(initialMedia);
  const [emoji, setEmoji] = useState(editing?.emoji ?? editingDef?.emoji ?? prefill.emoji ?? meta.emoji);
  const [category, setCategory] = useState<string>(editingDef?.category ?? "Movement");
  const [pickEmoji, setPickEmoji] = useState(false);
  const [heightText, setHeightText] = useState(editing?.heightCm != null ? String(round(fromCm(editing.heightCm, heightUnit), 1)) : "");
  const [weightText, setWeightText] = useState(editing?.weightKg != null ? String(round(fromKg(editing.weightKg, weightUnit), 2)) : "");
  const [headText, setHeadText] = useState(editing?.headCm != null ? String(round(fromCm(editing.headCm, heightUnit), 1)) : "");
  const [err, setErr] = useState("");
  const [recording, setRecording] = useState(false);
  const original = useMemo(() => new Set(filesOf(editing?.media ?? [])), []); // eslint-disable-line react-hooks/exhaustive-deps

  const cover = coverOf(media);
  const matched = kind === "milestone" ? editingDef ?? defs.find((d) => d.label.toLowerCase() === title.trim().toLowerCase()) : undefined;

  const openMilestones = useMemo(() => byAgeFit(suggestable.filter((d) => !memoryForDef(d, logged)), ageMonths).slice(0, 10), [suggestable, logged, ageMonths]);
  const ideas = useMemo(() => {
    if (kind !== "first" && kind !== "last") return [];
    const used = memories.filter((p) => p.childId === child.id && p.type === kind).map((p) => p.title);
    return openIdeas(kind === "first" ? FIRST_IDEAS : LAST_IDEAS, used).slice(0, 10);
  }, [kind, memories, child.id]);

  const discard = () => {
    filesOf(media).forEach((f) => !original.has(f) && deleteFile(f)); // anything added in this edit and not saved
    onClose();
  };

  const save = () => {
    setErr("");
    const finalTags = uniqueIds(tags);
    const place = location.trim() || undefined;
    if (date < earliestDate(child.birth)) return setErr(tr("That date is too long before the birth."));

    if (kind === "milestone") {
      const problem = logMilestone({ childId: child.id, defId: editingDef?.id, title, emoji, category, date, time, location: place, tagIds: finalTags, note: text, media });
      if (problem) return setErr(problem);
      if (!isEdit) setTimeout(() => useStore.getState().celebrate(`${emoji ?? "⭐"} ${title.trim() || "A new milestone"}!`), 350);
      return onClose();
    }

    let heightCm: number | undefined;
    let weightKg: number | undefined;
    let headCm: number | undefined;
    if (kind === "measure") {
      if (heightText.trim()) {
        const n = parseNumber(heightText);
        const cm = n == null ? NaN : toCm(n, heightUnit);
        if (!(cm >= 20 && cm <= 230)) return setErr(tr("That height doesn't look right — enter it in {0}.", [heightUnit]));
        heightCm = round(cm, 1);
      }
      if (weightText.trim()) {
        const n = parseNumber(weightText);
        const kg = n == null ? NaN : toKg(n, weightUnit);
        if (!(pet ? kg > 0.005 && kg <= 1500 : kg >= 0.5 && kg <= 180)) return setErr(tr("That weight doesn't look right — enter it in {0}.", [weightUnit]));
        weightKg = round(kg, 3);
      }
      if (headText.trim()) {
        const n = parseNumber(headText);
        const cm = n == null ? NaN : toCm(n, heightUnit);
        if (!(cm >= 20 && cm <= 70)) return setErr(tr("That head measurement doesn't look right. Enter it in {0}.", [heightUnit]));
        headCm = round(cm, 1);
      }
      if (heightCm == null && weightKg == null && headCm == null) return setErr(pet ? tr("Enter the weight.") : tr("Enter a height, a weight or a head measurement."));
    } else if (kind === "story") {
      if (!title.trim() && !text.trim() && !media.length) return setErr(tr("Add a title, a few words or a photo."));
    } else if (kind === "health") {
      if (!title.trim()) return setErr(tr("What was it? Example: “1-year check-up”."));
    } else if (!title.trim()) {
      return setErr(kind === "first" ? tr("What was the first? Example: “First bath”.") : tr("What was the last? Example: “Last bottle”."));
    }

    saveMemory({ id: editId, childId: child.id, type: kind, title, description: text, date, time, location: place, tagIds: finalTags, media, emoji, heightCm, weightKg, headCm, healthKind: kind === "health" ? healthKind : undefined });
    if (!isEdit && kind === "first") setTimeout(() => useStore.getState().celebrate(`${emoji ?? "✨"} ${title.trim()}!`), 350);
    onClose();
  };

  const remove = () =>
    Alert.alert(tr("Delete this {0}?", [kind === "measure" ? "measurement" : kind]), tr("This can't be undone."), [
      { text: tr("Cancel"), style: "cancel" },
      {
        text: tr("Delete"),
        style: "destructive",
        onPress: () => {
          if (editingDef?.custom) deleteCustomDef(child.id, editingDef.id); // also removes what was logged for it
          else if (editing) removeMemory(editing.id);
          onClose();
        },
      },
    ]);

  const chip = (on: boolean) => ({ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: on ? t.chipOn : t.card, borderWidth: 1, borderColor: on ? t.chipOn : t.line } as const);
  const heading =
    kind === "milestone" ? (isEdit ? "Edit milestone" : "Log a milestone")
    : kind === "measure" ? (pet ? (isEdit ? "Edit weight" : "Weight") : isEdit ? "Edit measurement" : "Measurement")
    : kind === "story" ? (isEdit ? "Edit story" : "New story")
    : kind === "first" ? (isEdit ? "Edit first" : "A new first")
    : kind === "health" ? (isEdit ? "Edit health entry" : "Health")
    : isEdit ? "Edit last" : "A new last";
  const L = TITLE[kind];
  const lockedTitle = kind === "milestone" && !!editingDef;

  return (
    <Sheet visible onClose={discard} title={heading}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
        {!cover ? (
          <Pressable onPress={() => setPickEmoji((v) => !v)} style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, alignItems: "center", justifyContent: "center" }} accessibilityLabel={tr("Change the icon")}>
            <Text style={{ fontSize: 30 }}>{emoji}</Text>
            <View style={{ position: "absolute", right: -4, bottom: -4, backgroundColor: t.accent, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" }}><Icon name="edit-2" size={12} color={t.onAccent} /></View>
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>{L.label}</Text>
          {lockedTitle ? (
            <Text style={{ color: t.ink, fontWeight: "700", fontSize: 18, paddingVertical: 8 }}>{editingDef!.label}</Text>
          ) : (
            <Input value={title} onChangeText={setTitle} placeholder={L.placeholder} maxLength={60} />
          )}
        </View>
      </View>
      {pickEmoji && !cover ? <View style={{ marginTop: 10 }}><EmojiPicker value={emoji} onChange={(e) => { setEmoji(e); setPickEmoji(false); }} /></View> : null}

      {/* milestone: type + typical age, and ideas due around now */}
      {kind === "milestone" ? (
        <View style={{ marginTop: 10 }}>
          {matched ? (
            <Text style={{ color: t.ink3, fontSize: 12.5, fontWeight: "700" }}>
              {areaOf(matched) === "Other" ? tr("Your own") : areaOf(matched)}
            </Text>
          ) : title.trim() ? (
            <>
              <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>{tr("Type")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {MILESTONE_CATEGORIES.map((c) => (
                  <Pressable key={c} onPress={() => setCategory(c)} style={chip(category === c)}>
                    <Text style={{ color: category === c ? t.onChipOn : t.ink2, fontWeight: "700", fontSize: 12 }}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
          {!isEdit && !editingDef && openMilestones.length ? (
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: t.ink3, fontSize: 11.5, fontWeight: "700", marginBottom: 6 }}>{tr("Due around {0}'s age:", [child.name])}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {openMilestones.map((d) => (
                  <Pressable key={d.id} onPress={() => { setTitle(d.label); setEmoji(d.emoji); }} style={chip(title === d.label)}>
                    <Text style={{ color: title === d.label ? t.onChipOn : t.ink2, fontWeight: "700", fontSize: 12 }}>{d.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* first / last: ideas */}
      {ideas.length && !isEdit ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: t.ink3, fontSize: 11.5, fontWeight: "700", marginBottom: 6 }}>{tr("Ideas:")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {ideas.map((i) => (
              <Pressable key={i.title} onPress={() => { setTitle(i.title); setEmoji(i.emoji); }} style={chip(title === i.title)}>
                <Text style={{ color: title === i.title ? t.onChipOn : t.ink2, fontWeight: "700", fontSize: 12 }}>{i.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {kind === "health" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
          {(pet ? PET_HEALTH_KINDS.map((k) => ({ id: k.id as HealthKind, label: `${k.emoji} ${k.label}` })) : HEALTH_KINDS).map((k) => (
            <Pressable key={k.id} onPress={() => setHealthKind(k.id)} accessibilityRole="radio" aria-checked={healthKind === k.id} style={chip(healthKind === k.id)}>
              <Text style={{ color: healthKind === k.id ? t.onChipOn : t.ink2, fontWeight: "700", fontSize: 12 }}>{k.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* height, weight and head circumference: any of them */}
      {kind === "measure" ? (
        <View style={{ backgroundColor: t.bg2, borderRadius: 16, padding: 14, marginTop: 14, gap: 4 }}>
          {!pet ? <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>{tr("Height")}</Text>
              <Input value={heightText} onChangeText={setHeightText} keyboardType="decimal-pad" placeholder={heightUnit === "cm" ? tr("Example: 74.5") : tr("Example: 29.5")} />
            </View>
            <View style={{ width: 92 }}><Seg options={[{ id: "cm" as const, label: tr("cm") }, { id: "in" as const, label: tr("in") }]} value={heightUnit} onChange={setHeightUnit} /></View>
          </View> : null}
          <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end", marginTop: pet ? 0 : 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>{tr("Weight")}</Text>
              <Input value={weightText} onChangeText={setWeightText} keyboardType="decimal-pad" placeholder={weightUnit === "kg" ? tr("Example: 9.2") : tr("Example: 20.3")} />
            </View>
            <View style={{ width: 92 }}><Seg options={[{ id: "kg" as const, label: tr("kg") }, { id: "lb" as const, label: tr("lb") }]} value={weightUnit} onChange={setWeightUnit} /></View>
          </View>
          {!pet ? <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end", marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>{tr("Head circumference")}</Text>
              <Input value={headText} onChangeText={setHeadText} keyboardType="decimal-pad" placeholder={heightUnit === "cm" ? tr("Example: 44") : tr("Example: 17.3")} />
            </View>
            <View style={{ width: 92 }}><Seg options={[{ id: "cm" as const, label: tr("cm") }, { id: "in" as const, label: tr("in") }]} value={heightUnit} onChange={setHeightUnit} /></View>
          </View> : null}
          <Text style={{ color: t.ink4, fontSize: 11.5, marginTop: 6 }}>{pet ? tr("It also appears in the Weight tab.") : tr("Fill in any of them. They also appear in the Growth tab.")}</Text>
        </View>
      ) : null}

      <Label>{L.text}</Label>
      <Input value={text} onChangeText={setText} multiline placeholder={L.textPlaceholder} />

      <Label>{tr("Date")}</Label>
      <DateField value={date} onChange={(d) => { setDate(d); setDateTouched(true); }} min={earliestDate(child.birth)} max={todayISO()} />
      <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12, marginTop: 6 }}>{date < child.birth ? ageShort(child.birth, date) : tr("{0} was {1}", [child.name, ageShort(child.birth, date).replace(" old", "")])}</Text>
      {kind !== "measure" ? (
        <>
          <TimeField value={time} onChange={setTime} />
          <Label>{tr("Location")}</Label>
          <Input value={location} onChangeText={setLocation} placeholder={tr("Where was this? (optional)")} maxLength={80} />
        </>
      ) : null}

      {/* the post's pictures: main picture, order, replace, remove, add more */}
      <MediaEditor
        media={visualMedia(media)}
        onChange={(pics) => setMedia([...pics, ...audioMedia(media)])}
        onAdded={(picked) => { if (!dateTouched && picked[0]?.date) setDate(picked[0].date < earliestDate(child.birth) ? earliestDate(child.birth) : picked[0].date); }} // use the photo's own date
        protectedFiles={original}
        label={kind === "measure" || kind === "milestone" ? tr("Photo") : tr("Photos & videos")}
      />

      {/* voice notes: record one on the spot or choose a file (not for measurements) */}
      {kind !== "measure" ? (
        <View style={{ marginTop: 12 }}>
          {audioMedia(media).map((a) => (
            <VoicePlayer key={a.id} item={a} onRemove={() => { if (!original.has(a.uri)) deleteFile(a.uri); setMedia(media.filter((x) => x.id !== a.id)); }} />
          ))}
          <Btn label={audioMedia(media).length ? tr("Add another voice note") : tr("Add a voice note")} icon="voice" kind="line" onPress={() => setRecording(true)} style={{ marginTop: 8 }} />
        </View>
      ) : null}
      {recording ? <VoiceRecorderSheet onClose={() => setRecording(false)} onDone={(item) => { setRecording(false); setMedia([...media, item]); }} /> : null}

      {/* tags: people, events, places and anything else — the same tags everywhere in the app */}
      <Label>{tr("Tags")}</Label>
      <TagPicker value={tags} onChange={setTags} location={location} />

      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 16, lineHeight: 19 }}>{err}</Text> : null}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 22 }}>
        {isEdit ? <DeleteButton onPress={remove} /> : <Btn label={tr("Cancel")} kind="soft" onPress={discard} />}
        <Btn label={isEdit ? tr("Save changes") : tr("Save")} onPress={save} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}
