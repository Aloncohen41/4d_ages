import React, { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useActiveChild, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { ageShort, formatDate } from "../lib/date";
import { coverOf, filesOf } from "../lib/display";
import { deleteFile } from "../lib/media";
import { MediaItem } from "../lib/types";
import { Btn, DateField, DeleteButton, Input, Label, Sheet, TimeField } from "./ui";
import { MediaEditor } from "./MediaEditor";
import { TagPicker } from "./TagPicker";

/** Edit a plain photo: date, time, note, location and tags. (Stories, milestones etc. use the "+" form.) */
export function EditPhotoSheet() {
  const id = useStore((s) => s.photoEdit);
  const setPhotoEdit = useStore((s) => s.setPhotoEdit);
  const photo = useStore((s) => (id ? s.memories.find((p) => p.id === id) : undefined));
  const child = useActiveChild();
  if (!id || !photo || !child) return null;
  return <PhotoForm key={id} photoId={id} onClose={() => setPhotoEdit(null)} />;
}

function PhotoForm({ photoId, onClose }: { photoId: string; onClose: () => void }) {
  const t = useTheme();
  const child = useActiveChild()!;
  const photo = useStore((s) => s.memories.find((p) => p.id === photoId))!;
  const saveMemory = useStore((s) => s.saveMemory);
  const removeMemory = useStore((s) => s.removeMemory);
  const updateChild = useStore((s) => s.updateChild);

  const [date, setDate] = useState(photo.date);
  const [time, setTime] = useState<string | undefined>(photo.time);
  const [caption, setCaption] = useState(photo.description);
  const [location, setLocation] = useState(photo.location ?? "");
  const [tags, setTags] = useState<string[]>(photo.tagIds ?? []);
  const [media, setMedia] = useState<MediaItem[]>(photo.media);
  const original = useMemo(() => new Set(filesOf(photo.media)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const isAvatar = child.avatarPhotoId === photo.id;
  const canAvatar = photo.type === "photo" && coverOf(photo.media)?.kind === "photo";
  const cancel = () => {
    filesOf(media).forEach((f) => !original.has(f) && deleteFile(f)); // pictures added in this edit and not saved
    onClose();
  };

  const save = () => {
    saveMemory({ id: photo.id, childId: photo.childId, type: "photo", description: caption.trim() || photo.description, date, time, location: location.trim() || undefined, tagIds: tags, media, emoji: photo.emoji, title: photo.title });
    onClose();
  };
  const remove = () =>
    Alert.alert("Delete this photo?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { removeMemory(photo.id); onClose(); } },
    ]);

  return (
    <Sheet visible onClose={cancel} title="Edit this post">
      <MediaEditor media={media} onChange={setMedia} protectedFiles={original} />
      <Text style={{ color: t.ink3, fontSize: 12, lineHeight: 17 }}>Photo dates are often wrong. Fix it here and the timeline re-orders itself.</Text>

      <Label>Date taken</Label>
      <DateField value={date} onChange={setDate} min={child.birth} />
      <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12, marginTop: 6 }}>{child.name} was {ageShort(child.birth, date).replace(" old", "")} on {formatDate(date)}</Text>
      <TimeField value={time} onChange={setTime} />
      <Label>Caption</Label>
      <Input value={caption} onChangeText={setCaption} multiline />
      <Label>Location</Label>
      <Input value={location} onChangeText={setLocation} placeholder="📍 Where was this? (optional)" maxLength={80} />
      <Label>Tags</Label>
      <TagPicker value={tags} onChange={setTags} location={location} />

      {canAvatar ? (
        <Btn kind="soft" disabled={isAvatar} label={isAvatar ? "✓ This is the profile picture" : `Use as ${child.name}'s profile picture`} onPress={() => { updateChild(child.id, { avatarPhotoId: photo.id, avatarCrop: undefined }); Alert.alert("Profile picture set", "Tap the picture at the top of the screen to move and zoom it."); }} style={{ marginTop: 16 }} />
      ) : null}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
        <DeleteButton onPress={remove} />
        <Btn label="Cancel" kind="soft" onPress={cancel} style={{ flex: 1 }} />
        <Btn label="Save" onPress={save} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}
