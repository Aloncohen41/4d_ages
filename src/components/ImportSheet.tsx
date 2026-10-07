import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, ToastAndroid, View } from "react-native";
import { router } from "expo-router";
import { APP_NAME } from "../brand";
import { uid, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { Child, MILESTONE_CATALOG, Memory, SharedItem } from "../lib/types";
import { memoryForDef } from "../lib/development";
import { milestonesLogged } from "../lib/selectors";
import { KIND_META } from "../lib/entries";
import { uniqueIds } from "../lib/tags";
import { ageBetween, formatDate, todayISO } from "../lib/date";
import { deleteFile } from "../lib/media";
import { defaultThumb, deleteThumb } from "../lib/videoThumbs";
import { summarize } from "../lib/sharedMedia";
import { logMilestone } from "../lib/saveMilestone";
import { FIRST_IDEAS, LAST_IDEAS, openIdeas } from "../lib/suggestions";
import { byAgeFit } from "../lib/milestones";
import { Avatar, Btn, DateField, Input, Label, PhotoView, Sheet, TimeField } from "./ui";
import { TagPicker } from "./TagPicker";
import { ThumbPicker } from "./ThumbPicker";
import { Icon } from "./Icon";

type ImportType = "photos" | "story" | "milestone" | "first" | "last";
const TYPES: { id: ImportType; label: string; hint: string }[] = [
  { id: "photos", label: "📷 Photos", hint: "Each one goes on the timeline on the day it was taken." },
  { id: "story", label: "📖 Story", hint: "Everything together as one memory." },
  { id: "milestone", label: "⭐ Milestone", hint: "A developmental milestone, with these as its pictures." },
  { id: "first", label: "🥇 First", hint: "Something they did for the first time." },
  { id: "last", label: "🏁 Last", hint: "A last time worth remembering." },
];
const PALETTE = ["peach", "sage", "butter", "rose", "sky", "lav"];

/**
 * Opens when photos or videos are shared to the app from Google Photos, the Gallery or any other app.
 * Confirm the media, add a note and tags, pick what it is — the original dates are kept.
 */
export function ImportSheet() {
  const t = useTheme();
  const incoming = useStore((s) => s.incoming);
  const setIncoming = useStore((s) => s.setIncoming);
  const kids = useStore((s) => s.kids);
  if (!incoming) return null;

  const discard = () => {
    incoming.items.forEach((i) => deleteFile(i.uri));
    setIncoming(null);
  };

  if (!incoming.items.length) {
    return (
      <Sheet visible onClose={() => setIncoming(null)} title="Getting your photos ready…">
        <View style={{ alignItems: "center", padding: 30 }}>
          <ActivityIndicator color={t.accent} size="large" />
          <Text style={{ color: t.ink3, marginTop: 14, textAlign: "center" }}>Copying {incoming.busy && incoming.busy > 1 ? `${incoming.busy} files` : "your files"} into {APP_NAME}. Big videos can take a moment.</Text>
        </View>
      </Sheet>
    );
  }
  if (!kids.length) {
    return (
      <Sheet visible onClose={discard} title="Add your little one first">
        <Text style={{ color: t.ink2, lineHeight: 21 }}>{APP_NAME} needs to know whose memories these are. Close this, add your child on the welcome screen, then share the photos again.</Text>
        <Btn label="Close" onPress={discard} style={{ marginTop: 18 }} />
      </Sheet>
    );
  }
  return <ImportForm items={incoming.items} onDiscard={discard} />;
}

function ImportForm({ items, onDiscard }: { items: SharedItem[]; onDiscard: () => void }) {
  const t = useTheme();
  const kids = useStore((s) => s.kids);
  const active = useStore((s) => s.kids.find((k) => k.id === s.activeId) ?? s.kids[0]);
  const memories = useStore((s) => s.memories);
  const custom = useStore((s) => s.customDefs);
  const setIncoming = useStore((s) => s.setIncoming);
  const setActive = useStore((s) => s.setActive);
  const addMemories = useStore((s) => s.addMemories);
  const saveMemory = useStore((s) => s.saveMemory);

  const [childId, setChildId] = useState(active.id);
  const child: Child = kids.find((k) => k.id === childId) ?? active;
  const [type, setType] = useState<ImportType>("photos");
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("");
  const [note, setNote] = useState("");
  const [location, setLocation] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>(null); // null = use the date from the photos
  const [time, setTime] = useState<string | undefined | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // a picture for each shared video: made automatically, and you can choose another frame
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [coverFor, setCoverFor] = useState<string | null>(null);
  useEffect(() => {
    items.filter((i) => i.kind === "video" && !thumbs[i.uri]).forEach((i) => {
      defaultThumb(i.uri).then((th) => th && setThumbs((cur) => (cur[i.uri] ? (deleteThumb(th), cur) : { ...cur, [i.uri]: th })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const dated = items.filter((i) => i.date);
  const earliest = dated.map((i) => i.date as string).sort()[0];
  const entryDate = date ?? earliest ?? todayISO();
  const entryTime = time === null ? items.find((i) => i.time)?.time : time;
  const beforeBirth = items.filter((i) => i.date && i.date < child.birth).length;
  const missing = items.length - dated.length;

  const age = ageBetween(child.birth, todayISO());
  const ageMonths = age.years * 12 + age.months;
  const ideas = useMemo(() => {
    if (type === "first" || type === "last") {
      const used = memories.filter((p) => p.childId === child.id && p.type === type).map((p) => p.title);
      return openIdeas(type === "first" ? FIRST_IDEAS : LAST_IDEAS, used).slice(0, 8).map((i) => ({ label: i.title, emoji: i.emoji }));
    }
    if (type === "milestone") {
      const done = milestonesLogged(memories, child.id);
      const defs = [...MILESTONE_CATALOG, ...(custom[child.id] || [])].filter((d) => !memoryForDef(d, done));
      return byAgeFit(defs, ageMonths).slice(0, 8).map((d) => ({ label: d.label, emoji: d.emoji }));
    }
    return [];
  }, [type, memories, custom, child.id, ageMonths]);

  const removeItem = (uri: string) => {
    deleteFile(uri);
    if (thumbs[uri]) deleteThumb(thumbs[uri]);
    const left = items.filter((i) => i.uri !== uri);
    setIncoming(left.length ? { items: left } : null);
  };

  const confirmDiscard = () =>
    Alert.alert("Discard these photos?", `Nothing will be added to ${APP_NAME}. The originals stay where they are.`, [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => { Object.values(thumbs).forEach(deleteThumb); onDiscard(); } },
    ]);

  const finish = (count: number, what: string) => {
    setActive(child.id);
    setIncoming(null);
    ToastAndroid.show(`Added ${what} to ${child.name}'s timeline`, ToastAndroid.LONG);
    router.navigate("/");
    return count;
  };

  const save = () => {
    setErr("");
    setBusy(true);
    try {
      const finalTags = uniqueIds(tags);
      const place = location.trim() || undefined;

      if (type === "photos") {
        const now = Date.now();
        const list: Memory[] = items.map((it, i) => ({
          id: uid("im"),
          childId: child.id,
          type: "photo" as const,
          date: it.date && it.date >= child.birth ? it.date : it.date ? child.birth : todayISO(), // each keeps its own date
          time: it.time,
          description: note.trim() || (it.kind === "video" ? "A little moment on video." : "A new memory."),
          media: [{ id: uid("mi"), uri: it.uri, kind: it.kind, ...(thumbs[it.uri] ? { thumb: thumbs[it.uri] } : {}) }],
          emoji: it.kind === "video" ? "🎬" : "📷",
          palette: PALETTE[i % PALETTE.length],
          tagIds: finalTags,
          location: place,
          source: "Shared",
          createdAt: now,
          updatedAt: now,
        }));
        addMemories(list);
        return finish(list.length, `${list.length} ${list.length === 1 ? "photo" : "photos"}`);
      }

      if (entryDate < child.birth) return setErr(`That date is before ${child.name}'s birth date.`);
      const media = items.map((it) => ({ id: uid("mi"), uri: it.uri, kind: it.kind, ...(thumbs[it.uri] ? { thumb: thumbs[it.uri] } : {}) }));
      if (type === "milestone") {
        const problem = logMilestone({ childId: child.id, title, emoji: emoji || KIND_META.milestone.emoji, category: "Other", date: entryDate, time: entryTime, location: place, tagIds: finalTags, note, media });
        if (problem) return setErr(problem);
        return finish(1, "a milestone");
      }
      if ((type === "first" || type === "last") && !title.trim()) return setErr(type === "first" ? "What was the first? e.g. “First bath”." : "What was the last? e.g. “Last bottle”.");
      saveMemory({ childId: child.id, type, title, description: note, date: entryDate, time: entryTime, location: place, tagIds: finalTags, media, emoji: emoji || KIND_META[type].emoji });
      return finish(1, type === "story" ? "a story" : type === "first" ? "a first" : "a last");
    } finally {
      setBusy(false);
    }
  };

  const chip = (on: boolean) => ({ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: on ? t.chipOn : t.card, borderWidth: 1, borderColor: on ? t.chipOn : t.line } as const);
  const current = TYPES.find((x) => x.id === type)!;

  return (
    <Sheet visible onClose={confirmDiscard} title={`Add to ${APP_NAME}`}>
      <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15 }}>{summarize(items, formatDate)}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {items.map((it) => (
          <View key={it.uri} style={{ width: "31.5%" }}>
            <View style={{ aspectRatio: 1, borderRadius: 12, overflow: "hidden" }}>
              <PhotoView photo={{ media: [{ id: it.uri, uri: it.uri, kind: it.kind, thumb: thumbs[it.uri] }], emoji: "📷", palette: "peach" }} fit="contain" style={{ width: "100%", height: "100%" }} emojiSize={24} />
              <Pressable onPress={() => removeItem(it.uri)} hitSlop={6} style={{ position: "absolute", right: 4, top: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: "#000a", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>✕</Text>
              </Pressable>
              {it.kind === "video" ? (
                <Pressable onPress={() => setCoverFor(it.uri)} hitSlop={6} accessibilityLabel="Choose the cover frame" style={{ position: "absolute", left: 4, bottom: 4, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#000b", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Icon name="film" size={11} color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>Cover</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={{ color: it.date ? t.ink3 : t.danger, fontSize: 10.5, fontWeight: "700", marginTop: 3 }} numberOfLines={1}>{it.date ? formatDate(it.date) : "no date found"}</Text>
          </View>
        ))}
      </View>

      {kids.length > 1 ? (
        <>
          <Label>Whose memories?</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {kids.map((k) => (
              <Pressable key={k.id} onPress={() => setChildId(k.id)} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5, paddingLeft: 5, paddingRight: 14, borderRadius: 12, backgroundColor: k.id === childId ? t.chipOn : t.card, borderWidth: 1, borderColor: k.id === childId ? t.chipOn : t.line }}>
                <Avatar child={k} size={28} />
                <Text style={{ color: k.id === childId ? t.onChipOn : t.ink2, fontWeight: "700" }}>{k.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Label>What is this?</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {TYPES.map((x) => (
          <Pressable key={x.id} onPress={() => { setType(x.id); setErr(""); }} style={chip(type === x.id)}>
            <Text style={{ color: type === x.id ? t.onChipOn : t.ink2, fontWeight: "700", fontSize: 12.5 }}>{x.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ color: t.ink4, fontSize: 12, marginTop: 6 }}>{current.hint}</Text>

      {type !== "photos" ? (
        <>
          <Label>{type === "milestone" ? "Milestone" : type === "first" ? "What was the first?" : type === "last" ? "What was the last?" : "Title (optional)"}</Label>
          <Input value={title} onChangeText={setTitle} placeholder={type === "milestone" ? "e.g. Rolls over" : type === "first" ? "e.g. First snow" : type === "last" ? "e.g. Last bottle" : "e.g. A day at the lake"} maxLength={60} />
          {ideas.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {ideas.map((i) => (
                <Pressable key={i.label} onPress={() => { setTitle(i.label); setEmoji(i.emoji); }} style={chip(title === i.label)}>
                  <Text style={{ color: title === i.label ? t.onChipOn : t.ink2, fontWeight: "700", fontSize: 12 }}>{i.emoji} {i.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      <Label>{type === "photos" ? "Caption for every photo (optional)" : "Notes"}</Label>
      <Input value={note} onChangeText={setNote} multiline placeholder={type === "story" ? "What happened? Who was there?" : "Anything you want to remember"} />

      {type === "photos" ? (
        <View style={{ backgroundColor: t.bg2, borderRadius: 14, padding: 12, marginTop: 14 }}>
          <Text style={{ color: t.ink2, fontSize: 12.5, lineHeight: 18 }}>
            📅 Each photo keeps the date it was taken{dated.length ? "" : " — none of these carry one, so they'll be dated today. Fix any date later with ✎."}
            {missing && dated.length ? ` ${missing} ${missing === 1 ? "has" : "have"} no date and will be dated today.` : ""}
            {beforeBirth ? ` ${beforeBirth} ${beforeBirth === 1 ? "is" : "are"} from before ${child.name} was born, so will sit on the birth date.` : ""}
          </Text>
        </View>
      ) : (
        <>
          <Label>Date</Label>
          <DateField value={entryDate} onChange={setDate} min={child.birth} max={todayISO()} />
          <Text style={{ color: t.ink4, fontSize: 11.5, marginTop: 5 }}>
            {date === null && earliest ? `From your photos — ${items.length > 1 && dated.length > 1 ? "the earliest one" : "when it was taken"}.` : date === null ? "No date in the files, so today's date is used." : "Chosen by you."}
          </Text>
          <TimeField value={entryTime} onChange={setTime} />
        </>
      )}

      <Label>Location</Label>
      <Input value={location} onChangeText={setLocation} placeholder="📍 Where was this? (optional)" maxLength={80} />

      <Label>Tags — people, events, places</Label>
      <TagPicker value={tags} onChange={setTags} location={location} />

      {coverFor ? (
        <ThumbPicker videoUri={coverFor} current={thumbs[coverFor]} onChoose={(th) => setThumbs((cur) => { if (cur[coverFor]) deleteThumb(cur[coverFor]); return { ...cur, [coverFor]: th }; })} onClose={() => setCoverFor(null)} />
      ) : null}
      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 16, lineHeight: 19 }}>{err}</Text> : null}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 22 }}>
        <Btn label="Cancel" kind="soft" onPress={confirmDiscard} />
        <Btn label={busy ? "Saving…" : type === "photos" ? `Add ${items.length} ${items.length === 1 ? "photo" : "photos"}` : "Save"} onPress={save} disabled={busy} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}
