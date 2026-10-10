import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useTheme } from "../lib/useTheme";
import { deleteThumb, videoFrames } from "../lib/videoThumbs";
import { Btn, Sheet } from "./ui";

/**
 * Pick the picture that stands for a video: three screenshots taken from it (and the current one, if any).
 * `onChoose` gets the chosen picture's file; frames you didn't choose are deleted.
 */
export function ThumbPicker({ videoUri, current, onChoose, onClose }: { videoUri: string; current?: string; onChoose: (thumb: string) => void; onClose: () => void }) {
  const t = useTheme();
  const [frames, setFrames] = useState<string[] | null>(null);
  const [picked, setPicked] = useState<string | undefined>(current);

  useEffect(() => {
    let alive = true;
    videoFrames(videoUri, 3).then((f) => alive && setFrames(f));
    return () => {
      alive = false;
    };
  }, [videoUri]);

  const finish = (chosen?: string) => {
    (frames ?? []).filter((f) => f !== chosen && f !== current).forEach(deleteThumb); // spare frames
    if (chosen && chosen !== current) onChoose(chosen);
    onClose();
  };

  const options = [...(current ? [current] : []), ...(frames ?? [])];
  return (
    <Sheet visible onClose={() => finish(undefined)} title="Choose the cover frame">
      <Text style={{ color: t.ink3, fontSize: 13, lineHeight: 19, marginBottom: 12 }}>Three screenshots from your video. Tap the one you want to show for it.</Text>
      {frames === null ? (
        <View style={{ alignItems: "center", padding: 30 }}><ActivityIndicator color={t.accent} /></View>
      ) : !options.length ? (
        <Text style={{ color: t.ink3, textAlign: "center", padding: 24 }}>Couldn't read frames from this video. If you've just updated the app, rebuild it once (npm run android).</Text>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {options.map((f, i) => (
            <Pressable key={f} onPress={() => setPicked(f)} style={{ width: "48%", aspectRatio: 16 / 10, borderRadius: 14, overflow: "hidden", borderWidth: 3, borderColor: picked === f ? t.accent : "transparent", backgroundColor: t.bg3 }}>
              <Image source={{ uri: f }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              {f === current && i === 0 ? <Text style={{ position: "absolute", left: 6, top: 6, backgroundColor: "#0009", color: "#fff", fontSize: 10, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, overflow: "hidden" }}>Current</Text> : null}
              {picked === f ? <Text style={{ position: "absolute", right: 6, bottom: 6, backgroundColor: t.accent, color: t.onAccent, fontSize: 11, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, overflow: "hidden" }}>✓</Text> : null}
            </Pressable>
          ))}
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
        <Btn label="Cancel" kind="soft" onPress={() => finish(undefined)} style={{ flex: 1 }} />
        <Btn label="Use this frame" onPress={() => finish(picked)} disabled={!picked} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}
