import React, { useEffect, useState } from "react";
import { earliestDate } from "./EntrySheet";
import { ActivityIndicator, Alert, Pressable, Text, ToastAndroid, View } from "react-native";
import { router } from "expo-router";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { APP_NAME } from "../brand";
import { uid, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { Child, Memory, SharedItem } from "../lib/types";
import { formatDate, parseISO, toISO, todayISO } from "../lib/date";
import { deleteFile } from "../lib/media";
import { defaultThumb, deleteThumb } from "../lib/videoThumbs";
import { summarize } from "../lib/sharedMedia";
import { buildNewPosts, PostShape } from "../lib/newPosts";
import { ShareKind, addableProfiles, shareOptions, startDate } from "../lib/shareTargets";
import { BUMP_SOURCE, weekOn } from "../lib/pregnancy";
import { skippedMessage } from "../lib/sharedMedia";
import { TYPE } from "../theme";
import { Avatar, Btn, DateField, Input, Label, PhotoView, Sheet } from "./ui";
import { ThumbPicker } from "./ThumbPicker";
import { Icon } from "./Icon";

/**
 * A new post from photos, videos and recordings: picked with the + button, or shared in from Google Photos, the Gallery, WhatsApp or any other
 * app. Shared in, you choose whose it is (from the profiles you can add to) and what it is: just the photos, a story, a first, a milestone, a
 * voice note, a bump photo… (the choices follow the profile and the files). Just the photos: one post or a post each, the dates from the
 * files, and OK saves. Anything else opens its own add screen with the files and the date already in it.
 */
export function ImportSheet() {
  const t = useTheme();
  const incoming = useStore((s) => s.incoming);
  const setIncoming = useStore((s) => s.setIncoming);
  const kids = useStore((s) => s.kids);
  if (!incoming) return null;
  const addable = addableProfiles(kids);

  const discard = () => {
    incoming.items.forEach((i) => { deleteFile(i.uri); if (i.thumb) deleteThumb(i.thumb); });
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
  if (!addable.length) {
    return (
      <Sheet visible onClose={discard} title={kids.length ? "Nowhere to add these yet" : "Add your little one first"}>
        <Text style={{ color: t.ink2, lineHeight: 21 }}>
          {kids.length
            ? `The books on this phone are shared with you to look at, so nothing can be added to them. Add your own child, bump or pet, then share these again.`
            : `${APP_NAME} needs to know whose memories these are. Close this, add your child, bump or pet, then share them again.`}
        </Text>
        <Btn label="Close" onPress={discard} style={{ marginTop: 18 }} />
      </Sheet>
    );
  }
  return <NewPostForm items={incoming.items} fromShare={incoming.source !== "picker"} caption={incoming.text} onDiscard={discard} />;
}

function NewPostForm({ items, fromShare, caption, onDiscard }: { items: SharedItem[]; fromShare: boolean; caption?: string; onDiscard: () => void }) {
  const t = useTheme();
  const allKids = useStore((s) => s.kids);
  const kids = addableProfiles(allKids); // only the profiles you can add to
  const activeId = useStore((s) => s.activeId);
  const active = kids.find((k) => k.id === activeId) ?? kids[0];
  const setIncoming = useStore((s) => s.setIncoming);
  const setActive = useStore((s) => s.setActive);
  const setEntrySheet = useStore((s) => s.setEntrySheet);
  const addMemories = useStore((s) => s.addMemories);

  const [childId, setChildId] = useState(active.id);
  const child: Child = kids.find((k) => k.id === childId) ?? active;
  // what it is: shared in, you choose; picked with the + button's "Photo or video", it's the photos
  const options = shareOptions(child, items);
  const [pick, setPick] = useState<ShareKind | null>(fromShare ? null : "post");
  const what = options.find((o) => o.id === pick) ?? (fromShare ? null : options.find((o) => o.id === "post") ?? null);
  const several = items.length > 1;
  const kindOf = what?.id === "bump" || what?.id === "ultrasound"; // a bump photo or a scan: one post each, by its own date
  const [shape0, setShape] = useState<PostShape | null>(several ? null : "one"); // with several, the parent chooses
  const shape: PostShape | null = kindOf && several ? "separate" : shape0;
  const [note, setNote] = useState(caption ?? "");
  const [oneDate, setOneDate] = useState<string | null>(null); // null = from the files
  const [dates, setDates] = useState<Record<string, string>>({}); // a date changed by hand, per file
  const [err, setErr] = useState("");
  // a picture for each video: made automatically (or already made when it was picked), and you can choose another frame
  const [thumbs, setThumbs] = useState<Record<string, string>>(() => Object.fromEntries(items.filter((i) => i.thumb).map((i) => [i.uri, i.thumb as string])));
  const [coverFor, setCoverFor] = useState<string | null>(null);
  useEffect(() => {
    items.filter((i) => i.kind === "video" && !thumbs[i.uri]).forEach((i) => {
      defaultThumb(i.uri).then((th) => th && setThumbs((cur) => (cur[i.uri] ? (deleteThumb(th), cur) : { ...cur, [i.uri]: th })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const today = todayISO();
  const fileDate = (it: SharedItem) => dates[it.uri] ?? it.date;
  const earliest = items.map(fileDate).filter((d): d is string => !!d).sort()[0];
  const postDate = oneDate ?? earliest ?? today;
  const undated = items.filter((i) => !fileDate(i)).length;

  const removeItem = (uri: string) => {
    deleteFile(uri);
    if (thumbs[uri]) deleteThumb(thumbs[uri]);
    const left = items.filter((i) => i.uri !== uri);
    setIncoming(left.length ? { items: left, source: fromShare ? "share" : "picker" } : null);
  };

  const confirmDiscard = () =>
    Alert.alert(fromShare ? "Discard these photos?" : "Don't add these?", `Nothing will be added to ${APP_NAME}. The originals stay where they are.`, [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => { Object.values(thumbs).forEach(deleteThumb); onDiscard(); } },
    ]);

  const changeDate = (uri: string, current: string) =>
    DateTimePickerAndroid.open({
      value: parseISO(current),
      mode: "date",
      minimumDate: parseISO(earliestDate(child.birth)),
      maximumDate: new Date(),
      onChange: (e, d) => { if (e.type === "set" && d) setDates((cur) => ({ ...cur, [uri]: toISO(d) })); },
    });

  // anything but photo posts: its own add screen, with the files and their date already in it
  const openEntry = () => {
    if (!what?.entry) return;
    const media = items.map((it) => ({ id: uid("mi"), uri: it.uri, kind: it.kind, ...(thumbs[it.uri] ? { thumb: thumbs[it.uri] } : {}) }));
    setActive(child.id);
    setIncoming(null); // the files now belong to the add screen (and are tidied away if it's cancelled)
    setTimeout(() => setEntrySheet({
      kind: what.entry!, media, date: startDate(items.map((it) => ({ date: fileDate(it) })), earliestDate(child.birth), today),
      ...(what.id === "voice" ? { title: "Voice note" } : {}),
    }), 250);
  };

  const save = () => {
    if (!what) return setErr("Choose what it is.");
    if (what.entry) return openEntry();
    if (!shape) return setErr("Choose one post or separate posts.");
    if (shape === "one" && postDate < earliestDate(child.birth)) return setErr(`That date is too long before ${child.expecting ? "the due date" : "the birth"}.`);
    const posts: Memory[] = buildNewPosts({
      child, shape, note,
      items: items.map((it) => ({ uri: it.uri, kind: it.kind, thumb: thumbs[it.uri], date: fileDate(it), time: dates[it.uri] ? undefined : it.time })),
      oneDate: postDate, today, newId: uid, now: Date.now(),
      ...(what.id === "bump" ? { as: { source: BUMP_SOURCE, emoji: "🤰", title: (d: string) => `Bump, week ${weekOn(child.birth, d)}` } } : {}),
      ...(what.id === "ultrasound" ? { as: { source: "Ultrasound", emoji: "🩻", title: (d: string) => `Ultrasound, week ${weekOn(child.birth, d)}` } } : {}),
    });
    addMemories(posts);
    setActive(child.id);
    setIncoming(null);
    ToastAndroid.show(`Added ${posts.length === 1 ? "a post" : `${posts.length} posts`} to ${child.name}'s story. Tap the pencil on a post to tag people.`, ToastAndroid.LONG);
    router.navigate("/");
  };

  const choice = (value: PostShape, title: string, sub: string) => {
    const on = shape === value;
    return (
      <Pressable onPress={() => { setShape(value); setErr(""); }} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ flex: 1, padding: 12, borderRadius: 16, borderWidth: on ? 2 : 1, borderColor: on ? t.accent : t.outline, backgroundColor: t.card }}>
        <Text style={[TYPE.titleSmall, { color: t.ink }]}>{title}</Text>
        <Text style={[TYPE.bodySmall, { color: t.ink2, marginTop: 2 }]}>{sub}</Text>
      </Pressable>
    );
  };

  return (
    <Sheet visible onClose={confirmDiscard} title={several ? `New post${shape === "separate" ? "s" : ""} from ${items.length} files` : "New post"}>
      <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 13.5 }}>{summarize(items, formatDate)}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {items.map((it) => {
          const d = fileDate(it);
          return (
            <View key={it.uri} style={{ width: "31.5%" }}>
              <View style={{ aspectRatio: 1, borderRadius: 12, overflow: "hidden" }}>
                <PhotoView photo={{ media: [{ id: it.uri, uri: it.uri, kind: it.kind, thumb: thumbs[it.uri] }], emoji: "", palette: "peach" }} fit="contain" style={{ width: "100%", height: "100%" }} emojiSize={24} />
                <Pressable onPress={() => removeItem(it.uri)} hitSlop={6} accessibilityLabel="Leave this one out" style={{ position: "absolute", right: 4, top: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: "#000a", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="x" size={15} color="#fff" />
                </Pressable>
                {it.kind === "video" ? (
                  <Pressable onPress={() => setCoverFor(it.uri)} hitSlop={6} accessibilityLabel="Choose the cover frame" style={{ position: "absolute", left: 4, bottom: 4, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#000b", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Icon name="film" size={11} color="#fff" />
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>Cover</Text>
                  </Pressable>
                ) : null}
              </View>
              {/* each post keeps its own file's date; tap it to change it */}
              {shape === "separate" ? (
                <Pressable onPress={() => changeDate(it.uri, d ?? today)} hitSlop={4} accessibilityLabel="Change this date">
                  <Text style={{ color: d ? t.accentDeep : t.danger, fontSize: 11, fontWeight: "700", marginTop: 3, textDecorationLine: "underline" }} numberOfLines={1}>{d ? formatDate(d) : "No date: today"}</Text>
                </Pressable>
              ) : (
                <Text style={{ color: d ? t.ink3 : t.danger, fontSize: 10.5, fontWeight: "700", marginTop: 3 }} numberOfLines={1}>{d ? formatDate(d) : "no date found"}</Text>
              )}
            </View>
          );
        })}
      </View>

      {fromShare && kids.length > 1 ? (
        <>
          <Label>Whose memories?</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {kids.map((k) => (
              <Pressable key={k.id} onPress={() => { setChildId(k.id); setErr(""); if (pick && !shareOptions(k, items).some((o) => o.id === pick)) setPick(null); }} accessibilityRole="radio" accessibilityState={{ selected: k.id === childId }} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5, paddingLeft: 5, paddingRight: 14, borderRadius: 12, backgroundColor: k.id === childId ? t.chipOn : t.card, borderWidth: 1, borderColor: k.id === childId ? t.chipOn : t.line }}>
                <Avatar child={k} size={28} />
                <Text style={{ color: k.id === childId ? t.onChipOn : t.ink2, fontWeight: "700" }}>{k.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {fromShare ? (
        <>
          <Label>What is it?</Label>
          <View style={{ gap: 6 }}>
            {options.map((o) => {
              const on = what?.id === o.id;
              return (
                <Pressable key={o.id} onPress={() => { setPick(o.id); setErr(""); }} accessibilityRole="radio" accessibilityState={{ selected: on }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 11, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accentSoft : t.card }}>
                  <Text style={{ fontSize: 22 }}>{o.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[TYPE.titleSmall, { color: t.ink }]}>{o.label}</Text>
                    <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{o.desc}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          {what?.entry ? <Text style={{ color: t.ink3, fontSize: 12.5, marginTop: 8 }}>Next, you'll fill in the rest, with {items.length > 1 ? "these files" : "this file"} already in it.</Text> : null}
        </>
      ) : null}

      {several && what && !what.entry && !kindOf ? (
        <>
          <Label>How should they be added?</Label>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {choice("one", "One post", "All of them together, on one date.")}
            {choice("separate", "Separate posts", "One post each, on the day it was taken.")}
          </View>
        </>
      ) : null}

      {what?.entry ? null : kindOf && several ? (
        <Text style={{ color: t.ink3, fontSize: 12.5, lineHeight: 18, marginTop: 12 }}>One each, by the week it was taken. Tap a date above to change it.</Text>
      ) : shape === "one" ? (
        <>
          <Label>Date</Label>
          <DateField value={postDate} onChange={setOneDate} min={earliestDate(child.birth)} max={today} />
          <Text style={{ color: t.ink4, fontSize: 11.5, marginTop: 5 }}>
            {oneDate !== null ? "Chosen by you." : earliest ? `From the ${several ? "earliest file" : "file"}. Tap to change it.` : "No date in the files, so today's date is used. Tap to change it."}
          </Text>
        </>
      ) : shape === "separate" ? (
        <Text style={{ color: t.ink3, fontSize: 12.5, lineHeight: 18, marginTop: 12 }}>
          Each post keeps the date its file was taken. Tap a date above to change it.{undated ? ` ${undated} ${undated === 1 ? "has" : "have"} no date and will be dated today.` : ""}
        </Text>
      ) : null}

      {shape && what && !what.entry ? (
        <>
          <Label>Description (optional)</Label>
          <Input value={note} onChangeText={setNote} multiline placeholder={shape === "separate" ? "Added to each post" : "What happened?"} accessibilityLabel="Description" />
        </>
      ) : null}

      {coverFor ? (
        <ThumbPicker videoUri={coverFor} current={thumbs[coverFor]} onChoose={(th) => setThumbs((cur) => { if (cur[coverFor]) deleteThumb(cur[coverFor]); return { ...cur, [coverFor]: th }; })} onClose={() => setCoverFor(null)} />
      ) : null}
      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 16, lineHeight: 19 }}>{err}</Text> : null}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 22 }}>
        <Btn label="Cancel" kind="soft" onPress={confirmDiscard} />
        <Btn label={what?.entry ? "Next" : "OK"} onPress={save} disabled={!what || (!what.entry && !shape)} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}
