import React from "react";
import { Pressable, Text, View } from "react-native";
import { isViewOnly, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { Child, MILESTONE_DEFS, MediaItem, Memory } from "../lib/types";
import { TYPE_META } from "../lib/entries";
import { ageShort, formatDate, formatSpan, formatTime } from "../lib/date";
import { formatHeight, formatWeight } from "../lib/growth";
import { Btn, PhotoView, Sheet } from "./ui";
import { Icon, IconName } from "./Icon";
import { VoicePlayer } from "./Voice";
import { ReactionSummary, Reactions } from "./Reactions";
import { audioMedia, visualMedia } from "../lib/display";
import { MediaCarousel } from "./MediaCarousel";
import { TagRow } from "./TagChip";

import { tr } from "../lib/i18n";
/** Opens the right form to edit a memory: a plain photo has its own; stories, milestones, firsts, lasts and measurements use the "+" form. */
export function useEditMemory() {
  const setEntrySheet = useStore((s) => s.setEntrySheet);
  const setPhotoEdit = useStore((s) => s.setPhotoEdit);
  // a child shared with this phone view-only can't be edited (the store refuses it too)
  return (p: Memory) => {
    if (isViewOnly(useStore.getState(), p.childId)) return;
    if (p.type === "milestone" && p.milestoneId) setEntrySheet({ kind: "milestone", editId: p.milestoneId });
    else if (p.type !== "photo") setEntrySheet({ kind: p.type, editId: p.id });
    else setPhotoEdit(p.id);
  };
}

/** The small label on a post: what kind of memory it is (a milestone says which). Words only, no emoji. */
export function usePostBadge(child: Child) {
  const defs = useStore((s) => s.customDefs);
  return (p: Memory) => {
    const ms = p.milestoneId ? [...MILESTONE_DEFS, ...(defs[child.id] || [])].find((d) => d.id === p.milestoneId)?.label : null;
    if (ms) return `Milestone: ${ms}`;
    return p.type === "photo" ? (p.media.some((m) => m.kind === "video") && !p.media.some((m) => m.kind === "photo") ? "Video" : "Photo") : TYPE_META[p.type].label;
  };
}

const hasPicture = (p: Memory) => p.media.some((m) => m.kind !== "audio" && (m.uri || m.thumb));

/**
 * One memory, the way the Home timeline shows it. A post with photos leads with them, whole and uncropped; a post without any is a compact card
 * (no empty picture area). Tapping the card opens it to read (`onView`); tapping a picture opens the full-screen gallery (`onOpenMedia`);
 * the pencil edits it.
 */
export function PostCard({ p, child, onView, onOpenMedia, onEdit }: {
  p: Memory; child: Child; onView: () => void; onOpenMedia: (index: number) => void; onEdit: () => void;
}) {
  const t = useTheme();
  const heightUnit = useStore((s) => s.heightUnit);
  const weightUnit = useStore((s) => s.weightUnit);
  const badge = usePostBadge(child)(p);
  const media = hasPicture(p);
  const badgeStyle = { backgroundColor: p.type === "milestone" ? t.gold : t.bg2, color: p.type === "milestone" ? t.goldInk : t.ink2, fontWeight: "700" as const, fontSize: 11, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, overflow: "hidden" as const };
  const meta = (icon: IconName, text: string) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Icon name={icon} size={13} color={t.ink3} />
      <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12 }}>{text}</Text>
    </View>
  );
  const measure = (icon: IconName, text: string) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: t.bg2, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 99 }}>
      <Icon name={icon} size={14} color={t.ink2} />
      <Text style={{ color: t.ink, fontWeight: "700" }}>{text}</Text>
    </View>
  );

  return (
    <Pressable onPress={onView} accessibilityRole="button" accessibilityLabel={`${badge}, ${formatDate(p.date)}`} style={{ backgroundColor: t.card, borderRadius: 22, padding: media ? 9 : 14, paddingBottom: 14, marginBottom: 16, borderWidth: 1, borderColor: t.line }}>
      {media ? (
        <>
          {visualMedia(p.media).length > 1 ? (
            <MediaCarousel media={visualMedia(p.media)} emoji={p.emoji} palette={p.palette} onOpen={onOpenMedia} />
          ) : (
            <Pressable onPress={() => onOpenMedia(0)}>
              {/* the whole picture, at its own shape — nothing is cropped */}
              <PhotoView photo={p} fit="auto" style={{ width: "100%", borderRadius: 16, overflow: "hidden", aspectRatio: 4 / 3 }} emojiSize={64} />
            </Pressable>
          )}
          <Text style={[badgeStyle, { position: "absolute", left: 18, top: 18 }]}>{badge}</Text>
        </>
      ) : (
        <View style={{ flexDirection: "row" }}><Text style={badgeStyle}>{badge}</Text></View>
      )}
      <View style={{ paddingHorizontal: media ? 6 : 0, paddingTop: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {meta("calendar", formatSpan(p.date, p.endDate))}
          <Text style={{ backgroundColor: t.accentSoft, color: t.onAccentSoft, fontWeight: "700", fontSize: 11, paddingHorizontal: 9, paddingVertical: 2, borderRadius: 99, overflow: "hidden" }}>{ageShort(child.birth, p.date)}</Text>
          <View style={{ flex: 1 }} />
          {child.role !== "viewer" ? (
            <Pressable onPress={onEdit} hitSlop={10} accessibilityLabel={tr("Edit")} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: t.bg2, alignItems: "center", justifyContent: "center" }}>
              <Icon name="edit-2" size={14} color={t.ink3} />
            </Pressable>
          ) : null}
        </View>
        {p.time || p.location ? (
          <View style={{ flexDirection: "row", gap: 14, marginTop: 4, flexWrap: "wrap" }}>
            {p.time ? meta("clock", formatTime(p.time)) : null}
            {p.location ? meta("place", p.location) : null}
          </View>
        ) : null}
        {p.title ? <Text style={{ color: t.ink, fontWeight: "700", fontSize: 17, marginTop: 6 }}>{p.title}</Text> : null}
        {p.heightCm != null || p.weightKg != null || p.headCm != null ? (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            {p.heightCm != null ? measure("add-measure", formatHeight(p.heightCm, heightUnit)) : null}
            {p.weightKg != null ? measure("scale", formatWeight(p.weightKg, weightUnit)) : null}
            {p.headCm != null ? measure("smile", `Head ${formatHeight(p.headCm, heightUnit)}`) : null}
          </View>
        ) : null}
        {p.description ? <Text style={{ color: t.ink, fontSize: 15.5, lineHeight: 21, marginTop: 6 }}>{p.description}</Text> : null}
        {audioMedia(p.media).map((a) => <VoicePlayer key={a.id} item={a} />)}
        <View style={{ marginTop: 8 }}><TagRow item={p} small skipPlace /></View>
        <ReactionSummary memoryId={p.id} onPress={onView} />
      </View>
    </Pressable>
  );
}

/** A memory opened to read: every picture, whole, and all its words. Editing is one deliberate tap away. */
export function PostViewer({ p, child, onClose, onOpenMedia, onEdit }: {
  p: Memory; child: Child; onClose: () => void; onOpenMedia: (items: MediaItem[], index: number) => void; onEdit: () => void;
}) {
  const t = useTheme();
  const badge = usePostBadge(child)(p);
  const items = visualMedia(p.media).filter((m) => m.uri || m.thumb);
  return (
    <Sheet visible onClose={onClose} title={p.title || badge}>
      <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12.5 }}>{badge} · {formatSpan(p.date, p.endDate)}{p.time ? ` · ${formatTime(p.time)}` : ""} · {ageShort(child.birth, p.date)}</Text>
      {p.location ? <Text style={{ color: t.ink3, fontSize: 12.5, marginTop: 2 }}>{p.location}</Text> : null}
      <View style={{ gap: 10, marginTop: 12 }}>
        {items.map((m, i) => (
          <Pressable key={m.id} onPress={() => onOpenMedia(items, i)} accessibilityLabel={m.kind === "video" ? tr("Play video") : tr("Open photo")}>
            <PhotoView photo={{ media: [m], emoji: p.emoji, palette: p.palette }} fit="auto" style={{ width: "100%", borderRadius: 16, overflow: "hidden", aspectRatio: 4 / 3 }} emojiSize={48} />
          </Pressable>
        ))}
      </View>
      {p.description ? <Text style={{ color: t.ink, fontSize: 16, lineHeight: 23, marginTop: 14 }}>{p.description}</Text> : null}
      {audioMedia(p.media).map((a) => <VoicePlayer key={a.id} item={a} />)}
      <View style={{ marginTop: 12 }}><TagRow item={p} skipPlace /></View>
      <Reactions memory={p} child={child} />
      <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
        <Btn label={tr("Close")} kind="soft" onPress={onClose} style={{ flex: 1 }} />
        {child.role !== "viewer" ? <Btn label={tr("Edit")} icon="edit-2" kind="line" onPress={onEdit} style={{ flex: 1 }} /> : null}
      </View>
    </Sheet>
  );
}
