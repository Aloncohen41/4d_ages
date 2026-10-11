import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import { MediaItem } from "../lib/types";
import { persistFile, deleteFile } from "../lib/media";
import { useTheme } from "../lib/useTheme";
import { TYPE } from "../theme";
import { Btn, Sheet } from "./ui";
import { Icon } from "./Icon";

/** "1:05" from seconds. */
export const clock = (secs: number) => {
  const s = Math.max(0, Math.round(secs || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const rid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** A voice note on a post: play and pause, how far along it is, and how long it is. */
export function VoicePlayer({ item, onRemove }: { item: MediaItem; onRemove?: () => void }) {
  const t = useTheme();
  const player = useAudioPlayer(item.uri ? { uri: item.uri } : null);
  const status = useAudioPlayerStatus(player);
  const ready = !!item.uri;
  const toggle = () => {
    if (status.playing) player.pause();
    else {
      if (status.duration && status.currentTime >= status.duration - 0.2) player.seekTo(0);
      player.play();
    }
  };
  const progress = status.duration ? Math.min(1, status.currentTime / status.duration) : 0;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: t.bg2, borderRadius: 99, paddingVertical: 6, paddingLeft: 6, paddingRight: 14, marginTop: 8 }}>
      <Pressable onPress={toggle} disabled={!ready} accessibilityRole="button" accessibilityLabel={status.playing ? "Pause the voice note" : "Play the voice note"}
        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.accent, alignItems: "center", justifyContent: "center", opacity: ready ? 1 : 0.4 }}>
        <Icon name={status.playing ? "pause" : "play"} size={18} color={t.onAccent} />
      </Pressable>
      <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: t.line, overflow: "hidden" }}>
        <View style={{ width: `${progress * 100}%`, height: 4, backgroundColor: t.accent }} />
      </View>
      <Text style={[TYPE.labelMedium, { color: t.ink2 }]}>{ready ? clock(status.playing || status.currentTime ? status.currentTime : status.duration) : "Downloading…"}</Text>
      {onRemove ? (
        <Pressable onPress={onRemove} accessibilityLabel="Remove the voice note" hitSlop={8}><Icon name="x" size={18} color={t.ink3} /></Pressable>
      ) : null}
    </View>
  );
}

/**
 * Record a voice note on the spot (a first laugh, a bedtime song), or choose an audio file from the phone. Hands back one media item; the file is
 * kept in the app's own storage, like photos.
 */
export function VoiceRecorderSheet({ onDone, onClose }: { onDone: (item: MediaItem) => void; onClose: () => void }) {
  const t = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [recorded, setRecorded] = useState<string | null>(null);
  const [err, setErr] = useState("");

  // anything recorded and not used is deleted when the sheet closes
  useEffect(() => () => { if (recorded) deleteFile(recorded); }, [recorded]);

  const start = async () => {
    setErr("");
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return setErr("Allow the microphone for this app to record (in the phone's Settings, Apps, 4D Ages, Permissions).");
    if (recorded) { deleteFile(recorded); setRecorded(null); }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  };
  const stop = async () => {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (recorder.uri) setRecorded(persistFile(recorder.uri, "m4a"));
  };
  const use = (uri: string) => {
    setRecorded(null); // handed over: not deleted on close
    onDone({ id: `mi-${rid()}`, uri, kind: "audio" });
  };
  const pickFile = async () => {
    setErr("");
    const res = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    const ext = (a.name.match(/\.([A-Za-z0-9]{2,5})$/)?.[1] || "m4a").toLowerCase();
    use(persistFile(a.uri, ext));
  };

  return (
    <Sheet visible onClose={onClose} title="Voice note">
      <View style={{ alignItems: "center", paddingVertical: 16 }}>
        <Text style={{ color: t.ink, fontSize: 40, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{clock((state.durationMillis ?? 0) / 1000)}</Text>
        <Pressable onPress={state.isRecording ? stop : start} accessibilityRole="button" accessibilityLabel={state.isRecording ? "Stop recording" : "Start recording"}
          style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: state.isRecording ? t.danger : t.accent, alignItems: "center", justifyContent: "center", marginTop: 14 }}>
          <Icon name={state.isRecording ? "stop" : "mic"} size={38} color="#fff" />
        </Pressable>
        <Text style={[TYPE.bodyMedium, { color: t.ink2, marginTop: 10 }]}>{state.isRecording ? "Recording… tap to stop" : recorded ? "Listen back, then use it or record again" : "Tap to record"}</Text>
      </View>
      {recorded && !state.isRecording ? (
        <>
          <VoicePlayer item={{ id: "preview", uri: recorded, kind: "audio" }} />
          <Btn label="Use this recording" icon="check" onPress={() => use(recorded)} style={{ marginTop: 14 }} />
        </>
      ) : null}
      <Btn label="Choose an audio file" icon="download" kind="line" onPress={pickFile} disabled={state.isRecording} style={{ marginTop: 12 }} />
      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 10 }}>{err}</Text> : null}
    </Sheet>
  );
}
