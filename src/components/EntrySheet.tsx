import React, { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useActiveChild, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { CATEGORY_EMOJI, Child, EntryKind, MILESTONE_CATALOG, MILESTONE_CATEGORIES, MILESTONE_DEFS, MediaItem } from "../lib/types";
import { areaOf, memoryForDef } from "../lib/development";
import { KIND_META, parseNumber } from "../lib/entries";
import { milestonesLogged } from "../lib/selectors";
import { uniqueIds } from "../lib/tags";
import { logMilestone } from "../lib/saveMilestone";
import { ageBetween, ageShort, todayISO } from "../lib/date";
import { fromCm, fromKg, toCm, toKg } from "../lib/growth";
import { deleteFile } from "../lib/media";
import { coverOf, filesOf } from "../lib/display";
import { FIRST_IDEAS, LAST_IDEAS, openIdeas } from "../lib/suggestions";
import { byAgeFit } from "../lib/milestones";
import { Btn, DateField, DeleteButton, Input, Label, Seg, Sheet, TimeField } from "./ui";
import { MediaEditor } from "./MediaEditor";
import { EmojiPicker } from "./EmojiPicker";
import { TagPicker } from "./TagPicker";

const TITLE: Record<EntryKind, { label: string; placeholder: string; text: string; textPlaceholder: string }> = {
  story: { label: "Title (optional)", placeholder: "Example: A day at the lake", text: "Your story", textPlaceholder: "What happened? Who was there? How did it feel?" },
  milestone: { label: "Milestone", placeholder: "Example: Rolls over", text: "Notes", textPlaceholder: "How it happened, who saw it… (optional)" },
  measure: { label: "Title (optional)", placeholder: "Example: 9-month check-up", text: "Note (optional)", textPlaceholder: "Anything worth remembering about this measurement" },
  first: { label: "What was the first?", placeholder: "Example: First bath, first snow…", text: "Description", textPlaceholder: "Tell the story of the first time (optional)" },
  last: { label: "What was the last?", placeholder: "Example: Last bottle, last nap in the cot…", text: "Description", textPlaceholder: "Tell the story of the last time (optional)" },
};

const round = (n: number, d: number) => Number(n.toFixed(d));

/** One form for every "+" option: story, milestone, height / weight, first and last. */
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
      prefill={{ title: sheet.title, emoji: sheet.emoji }}
      child={child}
      onClose={() => setEntrySheet(null)}
    />
  );
}

function EntryForm({ kind, editId, prefill, child, onClose }: { kind: EntryKind; editId?: string; prefill: { title?: string; emoji?: string }; child: Child; onClose: () => void }) {
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
  const initialMedia: MediaItem[] = editing?.media ?? [];

  const [title, setTitle] = useState(editing?.title ?? editingDef?.label ?? prefill.title ?? "");
  const [text, setText] = useState(editing?.description ?? "");
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [dateTouched, setDateTouched] = useState(isEdit);
  const [time, setTime] = useState<string | undefined>(editing?.time);
  const [location, setLocation] = useState(editing?.location ?? "");
  const [tags, setTags] = useState<string[]>(editing?.tagIds ?? []);
  const [media, setMedia] = useState<MediaItem[]>(initialMedia);
  const [emoji, setEmoji] = useState(editing?.emoji ?? editingDef?.emoji ?? prefill.emoji ?? meta.emoji);
  const [category, setCategory] = useState<string>(editingDef?.category ?? "Movement");
  const [pickEmoji, setPickEmoji] = useState(false);
  const [heightText, setHeightText] = useState(editing?.heightCm != null ? String(round(fromCm(editing.heightCm, heightUnit), 1)) : "");
  const [weightText, setWeightText] = useState(editing?.weightKg != null ? String(round(fromKg(editing.weightKg, weightUnit), 2)) : "");
  const [err, setErr] = useState("");
  const original = useMemo(() => new Set(filesOf(initialMedia)), []); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (date < child.birth) return setErr("That date is before the birth date.");

    if (kind === "milestone") {
      const problem = logMilestone({ childId: child.id, defId: editingDef?.id, title, emoji, category, date, time, location: place, tagIds: finalTags, note: text, media });
      if (problem) return setErr(problem);
      return onClose();
    }

    let heightCm: number | undefined;
    let weightKg: number | undefined;
    if (kind === "measure") {
      if (heightText.trim()) {
        const n = parseNumber(heightText);
        const cm = n == null ? NaN : toCm(n, heightUnit);
        if (!(cm >= 20 && cm <= 230)) return setErr(`That height doesn't look right — enter it in ${heightUnit}.`);
        heightCm = round(cm, 1);
      }
      if (weightText.trim()) {
        const n = parseNumber(weightText);
        const kg = n == null ? NaN : toKg(n, weightUnit);
        if (!(kg >= 0.5 && kg <= 180)) return setErr(`That weight doesn't look right — enter it in ${weightUnit}.`);
        weightKg = round(kg, 3);
      }
      if (heightCm == null && weightKg == null) return setErr("Enter a height, a weight, or both.");
    } else if (kind === "story") {
      if (!title.trim() && !text.trim() && !media.length) return setErr("Add a title, a few words or a photo.");
    } else if (!title.trim()) {
      return setErr(kind === "first" ? "What was the first? Example: “First bath”." : "What was the last? Example: “Last bottle”.");
    }

    saveMemory({ id: editId, childId: child.id, type: kind, title, description: text, date, time, location: place, tagIds: finalTags, media, emoji, heightCm, weightKg });
    onClose();
  };

  const remove = () =>
    Alert.alert(`Delete this ${kind === "measure" ? "measurement" : kind}?`, "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
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
    : kind === "measure" ? (isEdit ? "Edit height / weight" : "Height / weight")
    : kind === "story" ? (isEdit ? "Edit story" : "New story")
    : kind === "first" ? (isEdit ? "Edit first" : "A new first")
    : isEdit ? "Edit last" : "A new last";
  const L = TITLE[kind];
  const lockedTitle = kind === "milestone" && !!editingDef;

  return (
    <Sheet visible onClose={discard} title={heading}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
        {!cover ? (
          <Pressable onPress={() => setPickEmoji((v) => !v)} style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, alignItems: "center", justifyContent: "center" }} accessibilityLabel="Change the icon">
            <Text style={{ fontSize: 30 }}>{emoji}</Text>
            <Text style={{ position: "absolute", right: -4, bottom: -4, backgroundColor: t.accent, color: t.onAccent, width: 20, height: 20, borderRadius: 10, textAlign: "center", lineHeight: 20, fontSize: 9, overflow: "hidden" }}>✎</Text>
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
              {CATEGORY_EMOJI[areaOf(matched)]} {areaOf(matched) === "Other" ? "Your own" : areaOf(matched)}
            </Text>
          ) : title.trim() ? (
            <>
              <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>Type</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {MILESTONE_CATEGORIES.map((c) => (
                  <Pressable key={c} onPress={() => setCategory(c)} style={chip(category === c)}>
                    <Text style={{ color: category === c ? t.onChipOn : t.ink2, fontWeight: "700", fontSize: 12 }}>{CATEGORY_EMOJI[c]} {c}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
          {!isEdit && !editingDef && openMilestones.length ? (
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: t.ink3, fontSize: 11.5, fontWeight: "700", marginBottom: 6 }}>Due around {child.name}'s age:</Text>
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
          <Text style={{ color: t.ink3, fontSize: 11.5, fontWeight: "700", marginBottom: 6 }}>Ideas:</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {ideas.map((i) => (
              <Pressable key={i.title} onPress={() => { setTitle(i.title); setEmoji(i.emoji); }} style={chip(title === i.title)}>
                <Text style={{ color: title === i.title ? t.onChipOn : t.ink2, fontWeight: "700", fontSize: 12 }}>{i.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* height / weight, together or separately */}
      {kind === "measure" ? (
        <View style={{ backgroundColor: t.bg2, borderRadius: 16, padding: 14, marginTop: 14, gap: 4 }}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>Height</Text>
              <Input value={heightText} onChangeText={setHeightText} keyboardType="decimal-pad" placeholder={heightUnit === "cm" ? "Example: 74.5" : "Example: 29.5"} />
            </View>
            <View style={{ width: 92 }}><Seg options={[{ id: "cm" as const, label: "cm" }, { id: "in" as const, label: "in" }]} value={heightUnit} onChange={setHeightUnit} /></View>
          </View>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end", marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>Weight</Text>
              <Input value={weightText} onChangeText={setWeightText} keyboardType="decimal-pad" placeholder={weightUnit === "kg" ? "Example: 9.2" : "Example: 20.3"} />
            </View>
            <View style={{ width: 92 }}><Seg options={[{ id: "kg" as const, label: "kg" }, { id: "lb" as const, label: "lb" }]} value={weightUnit} onChange={setWeightUnit} /></View>
          </View>
          <Text style={{ color: t.ink4, fontSize: 11.5, marginTop: 6 }}>Fill in one or both. They also appear in the Growth tab.</Text>
        </View>
      ) : null}

      <Label>{L.text}</Label>
      <Input value={text} onChangeText={setText} multiline placeholder={L.textPlaceholder} />

      <Label>Date</Label>
      <DateField value={date} onChange={(d) => { setDate(d); setDateTouched(true); }} min={child.birth} max={todayISO()} />
      <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12, marginTop: 6 }}>{child.name} was {ageShort(child.birth, date).replace(" old", "")}</Text>
      {kind !== "measure" ? (
        <>
          <TimeField value={time} onChange={setTime} />
          <Label>Location</Label>
          <Input value={location} onChangeText={setLocation} placeholder="Where was this? (optional)" maxLength={80} />
        </>
      ) : null}

      {/* the post's pictures: main picture, order, replace, remove, add more */}
      <MediaEditor
        media={media}
        onChange={setMedia}
        onAdded={(picked) => { if (!dateTouched && picked[0]?.date) setDate(picked[0].date < child.birth ? child.birth : picked[0].date); }} // use the photo's own date
        protectedFiles={original}
        label={kind === "measure" || kind === "milestone" ? "Photo" : "Photos & videos"}
      />

      {/* tags: people, events, places and anything else — the same tags everywhere in the app */}
      <Label>Tags</Label>
      <TagPicker value={tags} onChange={setTags} location={location} />

      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 16, lineHeight: 19 }}>{err}</Text> : null}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 22 }}>
        {isEdit ? <DeleteButton onPress={remove} /> : <Btn label="Cancel" kind="soft" onPress={discard} />}
        <Btn label={isEdit ? "Save changes" : "Save"} onPress={save} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}
