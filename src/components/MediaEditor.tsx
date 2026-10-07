import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../lib/useTheme";
import { MediaItem } from "../lib/types";
import { filesOf } from "../lib/display";
import { Picked, deleteFile, pickMedia, toMediaItems } from "../lib/media";
import { Icon, IconName } from "./Icon";
import { Btn, MediaGallery, PhotoView } from "./ui";
import { ThumbPicker } from "./ThumbPicker";

/**
 * The pictures and videos of a post. The first one is the main picture (shown big everywhere); tap one to move it,
 * make it the main one, replace it, remove it — or add more. Nothing is deleted from the phone until you save.
 */
export function MediaEditor({ media, onChange, onAdded, protectedFiles, videos = true, label = "Photos & videos" }: {
  media: MediaItem[];
  onChange: (m: MediaItem[]) => void;
  onAdded?: (picked: Picked[]) => void; // e.g. use the first photo's date
  protectedFiles: Set<string>; // files that belonged to the post before this edit — never deleted here
  videos?: boolean;
  label?: string;
}) {
  const t = useTheme();
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [coverFor, setCoverFor] = useState<number | null>(null);
  useEffect(() => setSel((s) => Math.min(s, Math.max(0, media.length - 1))), [media.length]);

  // files added during this edit and then dropped are removed straight away; the post's original files wait for Save
  const drop = (m: MediaItem) => filesOf([m]).filter((f) => !protectedFiles.has(f)).forEach(deleteFile);

  const add = async () => {
    setBusy(true);
    try {
      const picked = await pickMedia({ videos, multiple: true });
      if (!picked.length) return;
      onChange([...media, ...toMediaItems(picked)]);
      onAdded?.(picked);
    } finally {
      setBusy(false);
    }
  };
  const replace = async (i: number) => {
    setBusy(true);
    try {
      const picked = await pickMedia({ videos, multiple: false });
      if (!picked.length) return;
      drop(media[i]);
      const next = media.slice();
      next[i] = toMediaItems(picked)[0];
      onChange(next);
    } finally {
      setBusy(false);
    }
  };
  const remove = (i: number) => {
    drop(media[i]);
    onChange(media.filter((_, k) => k !== i));
  };
  const move = (i: number, to: number) => {
    if (to < 0 || to >= media.length) return;
    const next = media.slice();
    const [it] = next.splice(i, 1);
    next.splice(to, 0, it);
    onChange(next);
    setSel(to);
  };

  const Tool = ({ icon, text, onPress, disabled, danger }: { icon: IconName; text: string; onPress: () => void; disabled?: boolean; danger?: boolean }) => (
    <Pressable onPress={onPress} disabled={disabled} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 99, backgroundColor: danger ? t.dangerSoft : t.card, borderWidth: 1, borderColor: danger ? t.danger : t.line, opacity: disabled ? 0.4 : 1 }}>
      <Icon name={icon} size={14} color={danger ? t.danger : t.ink2} />
      <Text style={{ color: danger ? t.danger : t.ink2, fontWeight: "700", fontSize: 12 }}>{text}</Text>
    </Pressable>
  );

  const cur = media[sel];
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 18, marginBottom: 8 }}>
        <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12 }}>{label} {media.length ? `(${media.length})` : ""}</Text>
        <Btn label={busy ? "Adding…" : media.length ? "＋ Add more" : "＋ Add"} onPress={add} disabled={busy} style={{ paddingVertical: 8, paddingHorizontal: 14 }} />
      </View>

      {!media.length ? (
        <Pressable onPress={add} style={{ borderWidth: 2, borderStyle: "dashed", borderColor: t.line, borderRadius: 14, padding: 18, alignItems: "center", backgroundColor: t.bg2 }}>
          <Icon name="image" size={24} color={t.ink3} />
          <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12.5, marginTop: 6 }}>Add a photo or video. The first one is the main picture.</Text>
        </Pressable>
      ) : (
        <>
          <Pressable onPress={() => setViewing(0)}>
            <PhotoView photo={{ media: [media[0]], emoji: "📷", palette: "peach" }} fit="auto" minRatio={0.75} maxRatio={1.6} style={{ width: "100%", borderRadius: 16, overflow: "hidden" }} emojiSize={36} />
            <Text style={{ position: "absolute", left: 10, top: 10, backgroundColor: t.gold, color: "#2c1f15", fontWeight: "700", fontSize: 11, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, overflow: "hidden" }}>★ Main picture</Text>
          </Pressable>

          {media.length > 1 ? <Text style={{ color: t.ink3, fontSize: 12, marginTop: 12, marginBottom: 6 }}>Tap a picture to move it, make it the main one, replace or remove it.</Text> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: media.length > 1 ? 0 : 12 }}>
            {media.map((m, i) => (
              <Pressable key={`${m.id}-${i}`} onPress={() => setSel(i)} style={{ width: "31.5%", aspectRatio: 1, borderRadius: 12, overflow: "hidden", borderWidth: 3, borderColor: i === sel ? t.accent : "transparent" }}>
                <PhotoView photo={{ media: [m], emoji: "📷", palette: "peach" }} fit="contain" style={{ width: "100%", height: "100%" }} emojiSize={22} />
                <Text style={{ position: "absolute", left: 5, top: 5, backgroundColor: i === 0 ? t.gold : "#0009", color: i === 0 ? "#2c1f15" : "#fff", fontWeight: "700", fontSize: 10, minWidth: 18, textAlign: "center", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 99, overflow: "hidden" }}>{i === 0 ? "★" : i + 1}</Text>
              </Pressable>
            ))}
          </View>

          {cur ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              <Tool icon="chevron-left" text="Earlier" onPress={() => move(sel, sel - 1)} disabled={sel === 0} />
              <Tool icon="chevron-right" text="Later" onPress={() => move(sel, sel + 1)} disabled={sel === media.length - 1} />
              <Tool icon="star" text="Make main" onPress={() => move(sel, 0)} disabled={sel === 0} />
              <Tool icon="refresh-cw" text="Replace" onPress={() => replace(sel)} disabled={busy} />
              {cur.kind === "video" ? <Tool icon="film" text="Cover frame" onPress={() => setCoverFor(sel)} /> : null}
              <Tool icon="trash-2" text="Remove" onPress={() => remove(sel)} danger />
            </View>
          ) : null}
        </>
      )}
      {coverFor !== null && media[coverFor]?.kind === "video" ? (
        <ThumbPicker
          videoUri={media[coverFor].uri}
          current={media[coverFor].thumb}
          onChoose={(thumb) => {
            const old = media[coverFor].thumb;
            if (old && !protectedFiles.has(old)) deleteFile(old); // a frame from this edit that you replaced
            onChange(media.map((m, k) => (k === coverFor ? { ...m, thumb } : m)));
          }}
          onClose={() => setCoverFor(null)}
        />
      ) : null}
      <MediaGallery items={viewing !== null ? media.filter((m) => m.uri) : null} index={viewing ?? 0} onClose={() => setViewing(null)} />
    </View>
  );
}
