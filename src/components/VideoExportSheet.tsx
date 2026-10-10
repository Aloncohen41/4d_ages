import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Sharing from "expo-sharing";
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
  VideoFormat, VideoQuality, cancelGrowVideo, createGrowVideo, defaultSubtitle, defaultTitle,
  dimensions, estimateSeconds, isVideoExportAvailable, saveVideoToGallery, secondsPerPhoto,
} from "../lib/videoExport";
import { Btn, Input, Label, PhotoView, Seg, Sheet } from "./ui";
import { HScroll } from "./HScroll";

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
      <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12, marginTop: 10, marginBottom: 6 }}>Preview speed</Text>
      <Seg options={[0.5, 1, 1.5, 2].map((v) => ({ id: v, label: `${v}×` }))} value={rate} onChange={setRate} />
    </View>
  );
}

/** Turn "Watch them grow" into an MP4. The speed you pick here is baked into the video. */
export function VideoExportSheet({ visible, onClose, slides, child, initialSpeed, title, subtitle, fileLabel }: {
  visible: boolean; onClose: () => void; slides: Slide[]; child: Child; initialSpeed: number; title?: string; subtitle?: string;
  /** What the video shows, for its file name: "1-2 years", "0-6 months", "2026"… */
  fileLabel?: string;
}) {
  const t = useTheme();
  const usable = slides.filter((s) => !!s.uri); // the movie is made from real pictures
  const [speed, setSpeed] = useState(initialSpeed);
  const [format, setFormat] = useState<VideoFormat>("square");
  const [quality, setQuality] = useState<VideoQuality>("720");
  const [intro, setIntro] = useState(true);
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
  const secs = estimateSeconds(usable.length, speed, intro);
  const [w, h] = dimensions(format, quality);
  const eta = Math.max(5, Math.round(usable.length * (quality === "1080" ? 1.6 : 0.8) * (format === "vertical" ? 1.5 : 1) * (secondsPerPhoto(speed) / 2.4) * 0.5 + 5));

  const create = async () => {
    setPhase("working"); setProgress(0); setMsg(""); started.current = Date.now();
    try {
      const out = await createGrowVideo(child, slides, t, { speed, format, quality, intro, title: heading, subtitle: subtitle || defaultSubtitle(child, usable.length), cover: intro ? cover?.uri ?? undefined : undefined }, setProgress);
      setUri(withFriendlyName(out, fileName)); // so it is shared under a proper name, not a random temporary one
      setPhase("done");
    } catch (e) {
      setPhase("idle");
      const m = e instanceof Error ? e.message : String(e);
      setMsg(m.includes("cancelled") ? "Cancelled." : m);
    }
  };

  const share = async () => {
    if (uri && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(uri, { mimeType: "video/mp4", dialogTitle: fileName.replace(/\.mp4$/, "") });
  };
  const save = async () => {
    if (!uri) return;
    try {
      await saveVideoToGallery(uri, fileName);
      setMsg(`✓ Saved to Movies / ${APP_NAME} on your phone.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't save the video.");
    }
  };

  const close = () => {
    if (phase === "working") cancelGrowVideo();
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title="Save as a video">
      {!isVideoExportAvailable() ? (
        <Text style={{ color: t.danger, fontWeight: "700", lineHeight: 20 }}>
          Video export needs a one-time rebuild of the app. On your computer run: npm run android — then try again.
        </Text>
      ) : null}

      <Label>Speed — how long each photo stays on screen</Label>
      <Seg options={GROW_SPEEDS.map((v) => ({ id: v, label: `${v}×` }))} value={speed} onChange={(v) => phase !== "working" && setSpeed(v)} />
      <Text style={{ color: t.ink3, fontSize: 12, marginTop: 6 }}>
        {secondsPerPhoto(speed).toFixed(1)}s per photo · {usable.length} photo{usable.length === 1 ? "" : "s"} · video is about {mmss(secs)} long
      </Text>

      <Label>Shape</Label>
      <Seg options={[{ id: "square" as VideoFormat, label: "Square" }, { id: "vertical" as VideoFormat, label: "Vertical (stories)" }]} value={format} onChange={(v) => phase !== "working" && setFormat(v)} />
      <Label>Quality</Label>
      <Seg options={[{ id: "720" as VideoQuality, label: "720p · faster" }, { id: "1080" as VideoQuality, label: "1080p · sharper" }]} value={quality} onChange={(v) => phase !== "working" && setQuality(v)} />
      <Text style={{ color: t.ink4, fontSize: 11.5, marginTop: 6 }}>{w}×{h}</Text>

      <Label>Title card</Label>
      <Seg options={[{ id: 1, label: "Show a title" }, { id: 0, label: "Skip it" }]} value={intro ? 1 : 0} onChange={(v) => phase !== "working" && setIntro(v === 1)} />
      {intro ? <Input value={heading} onChangeText={setHeading} style={{ marginTop: 8 }} maxLength={50} /> : null}
      {intro && usable.length > 1 ? (
        <>
          <Label>Cover — the picture the video starts with (its thumbnail)</Label>
          <HScroll contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {coverChoices.map((s) => {
              const on = s.id === cover?.id;
              return (
                <Pressable key={s.id} onPress={() => phase !== "working" && setCoverId(s.id)} accessibilityLabel="Use as the cover" accessibilityState={{ selected: on }} style={{ width: 76, height: 76, borderRadius: 12, overflow: "hidden", borderWidth: 3, borderColor: on ? t.accent : "transparent", backgroundColor: t.bg3 }}>
                  <PhotoView photo={slideView(s)} fit="cover" style={{ width: "100%", height: "100%" }} emojiSize={22} />
                  {on ? <Text style={{ position: "absolute", left: 0, right: 0, bottom: 0, textAlign: "center", color: t.onAccent, backgroundColor: t.accent, fontSize: 10, fontWeight: "700", paddingVertical: 1 }}>COVER</Text> : null}
                </Pressable>
              );
            })}
          </HScroll>
        </>
      ) : null}
      {!intro ? <Text style={{ color: t.ink4, fontSize: 11.5, marginTop: 6 }}>Without a title card the video starts with its first picture.</Text> : null}

      {phase === "working" ? (
        <View style={{ marginTop: 20 }}>
          <View style={{ height: 10, backgroundColor: t.bg3, borderRadius: 99, overflow: "hidden" }}>
            <View style={{ width: `${Math.round(progress * 100)}%`, height: "100%", backgroundColor: t.accent, borderRadius: 99 }} />
          </View>
          <Text style={{ color: t.ink3, textAlign: "center", marginTop: 8, fontSize: 12.5 }}>
            Making your video… {Math.round(progress * 100)}% — keep the app open (about {mmss(eta)} in total)
          </Text>
          <Btn label="Cancel" kind="soft" onPress={cancelGrowVideo} style={{ marginTop: 12 }} />
        </View>
      ) : (
        <Btn label={phase === "done" ? "🎬 Make it again with these settings" : "🎬 Create video"} onPress={create} disabled={!usable.length || !isVideoExportAvailable()} style={{ marginTop: 20 }} />
      )}

      <Text style={{ color: t.ink4, fontSize: 11.5, textAlign: "center", marginTop: 8 }}>Saved as “{fileName}”</Text>

      {phase === "done" && uri ? (
        <>
          <Preview uri={uri} />
          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <Btn label="Share…" onPress={share} style={{ flex: 1 }} />
            <Btn label="Save to phone" kind="line" onPress={save} style={{ flex: 1 }} />
          </View>
        </>
      ) : null}
      {msg ? <Text style={{ color: msg.startsWith("✓") ? t.accentDeep : t.danger, fontWeight: "700", textAlign: "center", marginTop: 12 }}>{msg}</Text> : null}
    </Sheet>
  );
}
