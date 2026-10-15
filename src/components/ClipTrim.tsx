import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { AppSlider } from "./AppSlider";
import { VideoView, useVideoPlayer } from "expo-video";
import { useTheme } from "../lib/useTheme";
import { CLIP_MAX_MS, clampClipStart } from "../lib/videoExport";

const mmss = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

/**
 * Choosing the 30 seconds of a long video that go into the made video: the clip plays those 30 seconds over and over, and the slider moves
 * them along (the clip shows where you are while you slide). The bar under it shows the part chosen within the whole video.
 */
export function ClipTrim({ uri, lengthMs, startMs, onChange }: { uri: string; lengthMs: number; startMs: number; onChange: (startMs: number) => void }) {
  const t = useTheme();
  const [pos, setPos] = useState(startMs);
  const sliding = useRef(false);
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = false;
  });
  // play the chosen part, and back to its start when it's over
  useEffect(() => {
    try {
      player.currentTime = startMs / 1000;
      player.play();
    } catch { /* the player is gone */ }
    const id = setInterval(() => {
      if (sliding.current) return;
      try {
        const now = player.currentTime * 1000;
        if (now >= startMs + CLIP_MAX_MS || now < startMs - 1000 || (!player.playing && now >= lengthMs - 300)) {
          player.currentTime = startMs / 1000;
          player.play();
        }
      } catch { /* the player is gone */ }
    }, 250);
    return () => clearInterval(id);
  }, [player, startMs, lengthMs]);

  const last = Math.max(0, lengthMs - CLIP_MAX_MS);
  const from = (pos / lengthMs) * 100;
  const span = (Math.min(CLIP_MAX_MS, lengthMs) / lengthMs) * 100;
  return (
    <View style={{ marginTop: 10 }}>
      <VideoView player={player} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 14, overflow: "hidden", backgroundColor: "#000" }} contentFit="contain" nativeControls={false} />
      <AppSlider
        label="Where the 30 seconds start"
        valueText={mmss(pos)}
        style={{ height: 42, marginTop: 6 }}
        minimumValue={0}
        maximumValue={last}
        step={500}
        value={startMs}
        onSlidingStart={() => { sliding.current = true; try { player.pause(); } catch { /* gone */ } }}
        onValueChange={(v: number) => { setPos(v); try { player.currentTime = v / 1000; } catch { /* gone */ } }}
        onSlidingComplete={(v: number) => { sliding.current = false; const s = clampClipStart(v, lengthMs); setPos(s); onChange(s); try { player.currentTime = s / 1000; player.play(); } catch { /* gone */ } }}
        minimumTrackTintColor={t.accent}
        maximumTrackTintColor={t.line}
        thumbTintColor={t.accent}
      />
      <View style={{ height: 8, borderRadius: 99, backgroundColor: t.bg3, overflow: "hidden", marginHorizontal: 14 }}>
        <View style={{ position: "absolute", left: `${from}%`, width: `${span}%`, top: 0, bottom: 0, borderRadius: 99, backgroundColor: t.accent }} />
      </View>
      <Text style={{ color: t.ink2, fontSize: 12.5, fontWeight: "700", textAlign: "center", marginTop: 8 }}>
        {mmss(pos)} – {mmss(Math.min(lengthMs, pos + CLIP_MAX_MS))} of {mmss(lengthMs)}
      </Text>
    </View>
  );
}
