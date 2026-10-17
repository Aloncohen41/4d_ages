import React, { useEffect, useMemo, useRef, useState } from "react";
import { isPet } from "../lib/types";
import { Icon } from "./Icon";
import { Pressable, Text, View } from "react-native";
import * as Sharing from "expo-sharing";
import { fileExport } from "../lib/fileExport";
import { VideoView, useVideoPlayer } from "expo-video";
import { GROW_SPEEDS } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { APP_NAME } from "../brand";
import { Child } from "../lib/types";
import { Slide, slideView } from "../lib/slides";
import { evenly } from "../lib/reels";
import { videoFileName } from "../lib/fileNames";
import { withFriendlyName } from "../lib/exportFiles";
import {
  CLIP_MAX_MS, VideoFormat, VideoQuality, cancelGrowVideo, clipPlays, createGrowVideo, defaultSubtitle, defaultTitle,
  dimensions, estimateSeconds, isVideoExportAvailable, saveVideoToGallery, secondsPerPhoto, videoLength,
} from "../lib/videoExport";
import { ClipTrim } from "./ClipTrim";
import { onWeb } from "../lib/onWeb";
import { downloadFile, shareFile } from "../lib/webDownload";
import { VideoStyleChoices } from "./VideoStyleChoices";
import { useStore } from "../lib/store";
import { MusicId, VideoTemplate, musicFor } from "../lib/videoStyles";
import { WhoMode, cardMs, filterByWho, storyWords } from "../lib/videoEvents";
import { formatDate } from "../lib/date";
import { Btn, Input, Label, PhotoView, Seg, Sheet } from "./ui";
import { HScroll } from "./HScroll";

import { tr } from "../lib/i18n";
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

function Preview({ uri }: { uri: string }) {
  const t = useTheme();
  const [rate, setRate] = useState(1);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  useEffect(() => {
    player.playbackRate = rate;
  }, [rate, player]);
  return (
    <View style={{ marginTop: 14 }}>
      <VideoView player={player} style={{ width: "100%", aspectRatio: 1, borderRadius: 16, overflow: "hidden", backgroundColor: "#000" }} nativeControls contentFit="contain" />
      <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12, marginTop: 10, marginBottom: 6 }}>{tr("Preview speed")}</Text>
      <Seg options={[0.5, 1, 1.5, 2].map((v) => ({ id: v, label: `${v}×` }))} value={rate} onChange={setRate} />
    </View>
  );
}

/** Turn "Watch them grow" into an MP4. The speed you pick here is baked into the video. */
export function VideoExportSheet({ visible, onClose, slides, child, initialSpeed, title, subtitle, fileLabel, eventKind, initialTemplate }: {
  visible: boolean; onClose: () => void; slides: Slide[]; child: Child; initialSpeed: number; title?: string; subtitle?: string;
  /** What the video shows, for its file name: "1-2 years", "0-6 months", "2026"… */
  fileLabel?: string;
  /** A suggested event's kind ("birthday", "trip"…), which picks the music that suits it, and the look it starts in. */
  eventKind?: string;
  initialTemplate?: VideoTemplate;
}) {
  const t = useTheme();
  const memories = useStore((s) => s.memories);
  const tags = useStore((s) => s.tags);
  // the look, the music, who's in it, and the words
  const [template, setTemplate] = useState<VideoTemplate>(initialTemplate ?? "classic");
  const [music, setMusic] = useState<MusicId>(() => musicFor(initialTemplate ?? "classic", eventKind, isPet(child)));
  const [musicChosen, setMusicChosen] = useState(false); // chosen by hand: a new look doesn't change it
  const [who, setWho] = useState<WhoMode>("all");
  const [cards, setCards] = useState<string[]>([]);
  const [ownWords, setOwnWords] = useState("");
  const [clipSound, setClipSound] = useState(true);
  const stories = useMemo(() => storyWords(memories, child.id), [memories, child.id]);
  const shown = useMemo(() => filterByWho(slides, memories, tags, who), [slides, memories, tags, who]);
  const usable = shown.filter((s) => !!s.uri || !!s.clip); // the movie is made from real pictures, and the videos play
  const wordCards = [
    ...(ownWords.trim() ? [{ id: "own", date: "", text: ownWords.trim() }] : []), // first of all
    ...stories.filter((s) => cards.includes(s.id)).map((s) => ({ id: s.id, date: s.date, text: s.text, kicker: s.title || formatDate(s.date) })),
  ];
  const clips = usable.filter((s) => !!s.clip);
  const [lengths, setLengths] = useState<Record<string, number>>({}); // each video's length (ms)
  const [clipStarts, setClipStarts] = useState<Record<string, number>>({}); // where the 30 seconds of a long one start
  const [trimming, setTrimming] = useState<string | null>(null); // the long video whose 30 seconds are being chosen
  const clipKey = clips.map((s) => s.id).join("|");
  useEffect(() => {
    if (!visible || !clips.length) return;
    let live = true;
    (async () => {
      const found: Record<string, number> = {};
      for (const s of clips) if (lengths[s.id] == null) found[s.id] = await videoLength(s.clip!);
      if (live && Object.keys(found).length) setLengths((l) => ({ ...l, ...found }));
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, clipKey]);
  const longClips = clips.filter((s) => (lengths[s.id] ?? 0) > CLIP_MAX_MS);
  const photoCount = usable.length - clips.length;
  const clipMs = clips.reduce((n, s) => n + clipPlays(lengths[s.id], clipStarts[s.id] ?? 0), 0);
  const [speed, setSpeed] = useState(initialSpeed);
  const [format, setFormat] = useState<VideoFormat>("square");
  const [quality, setQuality] = useState<VideoQuality>("720");
  const [intro, setIntro] = useState(true);
  const [memorial, setMemorial] = useState<string | null>(null); // a pet's video: an "In loving memory" ending
  const [heading, setHeading] = useState("");
  const [phase, setPhase] = useState<"idle" | "working" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [uri, setUri] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [coverId, setCoverId] = useState<string | null>(null); // null = the first picture
  const fileName = videoFileName(child.name, fileLabel || "Story"); // "Maya 1-2 years Video By 4D-Ages.mp4"
  const started = useRef(0);

  useEffect(() => {
    if (visible) {
      setSpeed(initialSpeed); setHeading(title || defaultTitle(child)); setPhase("idle"); setUri(null); setMsg(""); setProgress(0); setCoverId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const cover = usable.find((s) => s.id === coverId) ?? usable[0];
  // the pictures offered as the cover: spread across the video (never hundreds of thumbnails), always including the one chosen
  const coverChoices = (() => { const c = evenly(usable, 30); return cover && !c.includes(cover) ? [cover, ...c] : c; })();
  const secs = estimateSeconds(photoCount, speed, intro, clipMs + wordCards.reduce((n, c) => n + cardMs(c.text, 2400 / speed), 0));
  const [w, h] = dimensions(format, quality);
  const eta = Math.max(5, Math.round((photoCount * (secondsPerPhoto(speed) / 2.4) * 0.5 + (clipMs / 1000) * 0.6) * (quality === "1080" ? 1.6 : 0.8) * (format === "vertical" ? 1.5 : 1) + 5));

  const create = async () => {
    setPhase("working"); setProgress(0); setMsg(""); started.current = Date.now();
    try {
      const out = await createGrowVideo(child, shown, t, { speed, format, quality, intro, template, music, clipSound, cards: wordCards, title: heading, subtitle: subtitle || defaultSubtitle(child, usable.length), cover: intro ? cover?.uri ?? undefined : undefined, ...(memorial != null ? { memorial } : {}), clipStarts, clipLengths: lengths }, setProgress);
      setUri(await withFriendlyName(out, fileName)); // so it is shared under a proper name, not a random temporary one
      setPhase("done");
    } catch (e) {
      setPhase("idle");
      const m = e instanceof Error ? e.message : String(e);
      setMsg(m.includes("cancelled") ? tr("Cancelled.") : m);
    }
  };

  // the website's video may be WebM (the browser's own kind), so its name ends to match
  const webName = uri && /.webm$/i.test(uri) ? fileName.replace(/.mp4$/, ".webm") : fileName;
  const share = async () => {
    if (!uri) return;
    if (onWeb) { if ((await shareFile(uri, webName, /.webm$/i.test(webName) ? "video/webm" : "video/mp4")) === "downloaded") setMsg(tr("✓ Downloaded.")); return; }
    const fx = fileExport(); // the share menu without waiting for an answer (see modules/file-export)
    if (fx) return fx.share(uri, "video/mp4", fileName.replace(/\.mp4$/, ""));
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "video/mp4", dialogTitle: fileName.replace(/\.mp4$/, "") });
  };
  const save = async () => {
    if (!uri) return;
    if (onWeb) { downloadFile(uri, webName); setMsg(tr("✓ Downloaded.")); return; }
    try {
      await saveVideoToGallery(uri, fileName);
      setMsg(tr("✓ Saved to Movies / {0} on your phone.", [APP_NAME]));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : tr("Couldn't save the video."));
    }
  };

  const close = () => {
    if (phase === "working") cancelGrowVideo();
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title={tr("Save as a video")}>
      {!isVideoExportAvailable() ? (
        <Text style={{ color: t.danger, fontWeight: "700", lineHeight: 20 }}>
          {tr("Video export needs a one-time rebuild of the app. On your computer run: npm run android — then try again.")}
        </Text>
      ) : null}

      <VideoStyleChoices
        template={template} onTemplate={(v) => { setTemplate(v); if (!musicChosen) setMusic(musicFor(v, eventKind, isPet(child))); }}
        music={music} onMusic={(m) => { setMusic(m); setMusicChosen(true); }}
        who={who} onWho={setWho} childName={child.name}
        stories={stories} cards={cards} onCards={setCards} ownWords={ownWords} onOwnWords={setOwnWords}
        hasClips={clips.length > 0} clipSound={clipSound} onClipSound={setClipSound}
        disabled={phase === "working"}
      />
      {!usable.length ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 8 }}>{tr("No pictures match \"{0}\". Choose Everyone, or tag people in your posts.", [who === "alone" ? `Only ${child.name}` : "With family"])}</Text> : null}

      <Label>{tr("Speed — how long each photo stays on screen")}</Label>
      <Seg options={GROW_SPEEDS.map((v) => ({ id: v, label: `${v}×` }))} value={speed} onChange={(v) => phase !== "working" && setSpeed(v)} />
      <Text style={{ color: t.ink3, fontSize: 12, marginTop: 6 }}>
        {tr("{0}s per photo · {1} photo{2}{3} · video is about {4} long", [secondsPerPhoto(speed).toFixed(1), photoCount, photoCount === 1 ? "" : "s", clips.length ? ` · ${clips.length} video${clips.length === 1 ? "" : "s"}` : "", mmss(secs)])}
      </Text>
      {clips.length ? (
        <Text style={{ color: t.ink3, fontSize: 12, marginTop: 4 }}>{tr("Videos play in it as they are, without their sound{0}.", [longClips.length ? ", up to 30 seconds each" : ""])}</Text>
      ) : null}
      {longClips.length ? (
        <>
          <Label>{tr("Long videos: choose the 30 seconds to show")}</Label>
          {longClips.map((s) => {
            const open = trimming === s.id;
            const start = clipStarts[s.id] ?? 0;
            return (
              <View key={s.id} style={{ marginBottom: 10, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: open ? t.accent : t.line }}>
                <Pressable onPress={() => phase !== "working" && setTrimming(open ? null : s.id)} accessibilityRole="button" accessibilityLabel={tr("Choose the 30 seconds")} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 10, overflow: "hidden", backgroundColor: t.bg3 }}>
                    <PhotoView photo={slideView(s)} fit="cover" style={{ width: "100%", height: "100%" }} emojiSize={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.ink, fontWeight: "700", fontSize: 14 }} numberOfLines={1}>{s.caption || "A video"}</Text>
                    <Text style={{ color: t.ink3, fontSize: 12 }}>{tr("Shows {0} – {1} of {2}", [mmss(start / 1000), mmss(Math.min(lengths[s.id], start + CLIP_MAX_MS) / 1000), mmss(lengths[s.id] / 1000)])}</Text>
                  </View>
                  <Icon name={open ? "chevron-up" : "chevron-down"} size={20} color={t.accent} />
                </Pressable>
                {open ? <ClipTrim uri={s.clip!} lengthMs={lengths[s.id]} startMs={start} onChange={(v) => setClipStarts((m) => ({ ...m, [s.id]: v }))} /> : null}
              </View>
            );
          })}
        </>
      ) : null}

      <Label>{tr("Shape")}</Label>
      <Seg options={[{ id: "square" as VideoFormat, label: tr("Square") }, { id: "vertical" as VideoFormat, label: tr("Vertical (stories)") }]} value={format} onChange={(v) => phase !== "working" && setFormat(v)} />
      <Label>{tr("Quality")}</Label>
      <Seg options={[{ id: "720" as VideoQuality, label: tr("720p · faster") }, { id: "1080" as VideoQuality, label: tr("1080p · sharper") }]} value={quality} onChange={(v) => phase !== "working" && setQuality(v)} />
      <Text style={{ color: t.ink4, fontSize: 11.5, marginTop: 6 }}>{w}×{h}</Text>

      <Label>{tr("Title card")}</Label>
      <Seg options={[{ id: 1, label: tr("Show a title") }, { id: 0, label: tr("Skip it") }]} value={intro ? 1 : 0} onChange={(v) => phase !== "working" && setIntro(v === 1)} />
      {intro ? <Input value={heading} onChangeText={setHeading} accessibilityLabel={tr("The video's title")} style={{ marginTop: 8 }} maxLength={50} /> : null}
      {intro && usable.length > 1 ? (
        <>
          <Label>{tr("Cover — the picture the video starts with (its thumbnail)")}</Label>
          <HScroll contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {coverChoices.map((s) => {
              const on = s.id === cover?.id;
              return (
                <Pressable key={s.id} onPress={() => phase !== "working" && setCoverId(s.id)} accessibilityLabel={tr("Use as the cover")} aria-pressed={on} style={{ width: 76, height: 76, borderRadius: 12, overflow: "hidden", borderWidth: 3, borderColor: on ? t.accent : "transparent", backgroundColor: t.bg3 }}>
                  <PhotoView photo={slideView(s)} fit="cover" style={{ width: "100%", height: "100%" }} emojiSize={22} />
                  {on ? <Text style={{ position: "absolute", left: 0, right: 0, bottom: 0, textAlign: "center", color: t.onAccent, backgroundColor: t.accent, fontSize: 10, fontWeight: "700", paddingVertical: 1 }}>{tr("COVER")}</Text> : null}
                </Pressable>
              );
            })}
          </HScroll>
        </>
      ) : null}
      {!intro ? <Text style={{ color: t.ink4, fontSize: 11.5, marginTop: 6 }}>{tr("Without a title card the video starts with its first picture.")}</Text> : null}
      {isPet(child) ? (
        <View style={{ marginTop: 14 }}>
          <Pressable onPress={() => phase !== "working" && setMemorial(memorial == null ? "" : null)} accessibilityRole="checkbox" aria-checked={memorial != null} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Icon name={memorial != null ? "check-square" : "square"} size={22} color={t.accent} />
            <Text style={{ color: t.ink, fontSize: 15, flex: 1 }}>{tr("End with \"In loving memory\"")}</Text>
          </Pressable>
          {memorial != null ? <Input value={memorial} onChangeText={setMemorial} placeholder={tr("A few words. Example: Forever in our hearts")} style={{ marginTop: 8 }} maxLength={120} /> : null}
        </View>
      ) : null}

      {phase === "working" ? (
        <View style={{ marginTop: 20 }}>
          <View style={{ height: 10, backgroundColor: t.bg3, borderRadius: 99, overflow: "hidden" }}>
            <View style={{ width: `${Math.round(progress * 100)}%`, height: "100%", backgroundColor: t.accent, borderRadius: 99 }} />
          </View>
          <Text style={{ color: t.ink3, textAlign: "center", marginTop: 8, fontSize: 12.5 }}>
            {tr("Making your video… {0}% — keep the app open (about {1} in total)", [Math.round(progress * 100), mmss(eta)])}
          </Text>
          <Btn label={tr("Cancel")} kind="soft" onPress={cancelGrowVideo} style={{ marginTop: 12 }} />
        </View>
      ) : (
        <Btn icon="film" label={phase === "done" ? tr("Make it again with these settings") : tr("Create video")} onPress={create} disabled={!usable.length || !isVideoExportAvailable()} style={{ marginTop: 20 }} />
      )}

      <Text style={{ color: t.ink4, fontSize: 11.5, textAlign: "center", marginTop: 8 }}>{tr("Saved as “{0}”", [fileName])}</Text>

      {phase === "done" && uri ? (
        <>
          <Preview uri={uri} />
          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <Btn label={tr("Share…")} onPress={share} style={{ flex: 1 }} />
            <Btn label={onWeb ? tr("Download") : tr("Save to phone")} kind="line" onPress={save} style={{ flex: 1 }} />
          </View>
        </>
      ) : null}
      {msg ? <Text style={{ color: msg.startsWith("✓") ? t.accentDeep : t.danger, fontWeight: "700", textAlign: "center", marginTop: 12 }}>{msg}</Text> : null}
    </Sheet>
  );
}
