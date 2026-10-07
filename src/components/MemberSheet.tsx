import React, { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { uid, useActiveChild, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { AvatarCrop, RELATION_EMOJI, RELATION_PRESETS, Relative } from "../lib/types";
import { itemsWithTags, personLabel, personTag } from "../lib/tags";
import { deleteFile, pickMedia } from "../lib/media";
import { Avatar, Btn, DeleteButton, Input, Label, MemberAvatar, Sheet } from "./ui";
import { AvatarCropper } from "./AvatarCropper";
import { EmojiPicker } from "./EmojiPicker";

/** Add or edit a family member: name, relationship, their own wording, and a profile picture. */
export function MemberSheet({ memberId, presetRelation, onClose }: { memberId?: string; presetRelation?: string; onClose: () => void }) {
  const t = useTheme();
  const existing = useStore((s) => (memberId ? s.relatives.find((r) => r.id === memberId) : undefined));
  const memories = useStore((s) => s.memories);
  const addRelative = useStore((s) => s.addRelative);
  const updateRelative = useStore((s) => s.updateRelative);
  const removeRelative = useStore((s) => s.removeRelative);
  const setRelativeChildren = useStore((s) => s.setRelativeChildren);
  const kids = useStore((s) => s.kids);
  const active = useActiveChild();

  const startRelation = existing?.relation ?? presetRelation ?? "Mom";
  const [name, setName] = useState(existing?.name ?? "");
  const [relation, setRelation] = useState(startRelation);
  const [custom, setCustom] = useState(existing?.customLabel ?? "");
  const [photoUri, setPhotoUri] = useState<string | undefined>(existing?.photoUri);
  const [crop, setCrop] = useState<AvatarCrop | undefined>(existing?.crop);
  const [emoji, setEmoji] = useState(existing?.emoji ?? RELATION_EMOJI[startRelation] ?? "🙂");
  const [emojiTouched, setEmojiTouched] = useState(!!existing);
  const [showEmoji, setShowEmoji] = useState(false);
  const [err, setErr] = useState("");
  // whose family(ies) this person is in: a new person joins the child you are looking at; someone from before per-child families is in everyone's
  const everyone = kids.map((k) => k.id).filter((id) => id !== existing?.childRef); // someone who IS a child is never in that child's own family
  const startFamilies = existing ? (existing.childIds ?? everyone).filter((id) => id !== existing.childRef) : active ? [active.id] : everyone;
  const [families, setFamilies] = useState<string[]>(startFamilies);
  const original = existing?.photoUri;

  const pickRelation = (r: string) => {
    setRelation(r);
    if (!emojiTouched) setEmoji(RELATION_EMOJI[r] ?? "🙂");
  };

  const choosePhoto = async () => {
    const picked = await pickMedia({ videos: false, multiple: false });
    if (!picked.length) return;
    if (photoUri && photoUri !== original) deleteFile(photoUri); // an earlier choice that was never saved
    setPhotoUri(picked[0].uri);
    setCrop(undefined);
  };

  const discard = () => {
    if (photoUri && photoUri !== original) deleteFile(photoUri);
    onClose();
  };

  const save = () => {
    if (!name.trim() && !custom.trim()) return setErr("Add a name (or at least a relationship wording like “Nana”).");
    if (!families.length) return setErr("Choose at least one child's family — or remove this person.");
    const data: Omit<Relative, "id"> = { name: name.trim(), relation, customLabel: custom.trim() || undefined, emoji, photoUri, crop: photoUri ? crop : undefined };
    if (existing) {
      updateRelative(existing.id, data);
      if (original && original !== photoUri) deleteFile(original);
      const before = [...startFamilies].sort().join();
      if ([...families].sort().join() !== before) setRelativeChildren(existing.id, families); // only touched when it really changed
    } else addRelative({ id: uid("rel"), ...data, childIds: families });
    onClose();
  };

  const remove = () => {
    if (!existing) return;
    const n = itemsWithTags(memories, [personTag(existing).id]).length;
    const shared = (existing.childIds ?? everyone).length > 1 ? " They'll be removed from every child's family — to take them out of just one, untick that child under “In the family of” and save instead." : "";
    Alert.alert(`Remove ${personLabel(existing)}?`, (n ? `They'll be taken off the ${n} memor${n === 1 ? "y" : "ies"} they're tagged in. The memories themselves stay.` : "This can't be undone.") + shared, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => { removeRelative(existing.id); onClose(); } },
    ]);
  };

  const chip = (on: boolean) => ({ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 12, backgroundColor: on ? t.chipOn : t.card, borderWidth: 1, borderColor: on ? t.chipOn : t.line } as const);

  return (
    <Sheet visible onClose={discard} title={existing ? "Edit family member" : "Add a family member"}>
      <View style={{ alignItems: "center", marginBottom: 6 }}>
        <MemberAvatar member={{ photoUri, crop, emoji }} size={84} ring />
      </View>

      <Label>Name</Label>
      <Input value={name} onChangeText={setName} placeholder="e.g. Sarah" maxLength={40} />

      <Label>Relationship</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {RELATION_PRESETS.map((r) => (
          <Pressable key={r} onPress={() => pickRelation(r)} style={chip(relation === r)}>
            <Text style={{ color: relation === r ? t.onChipOn : t.ink2, fontWeight: "700", fontSize: 12.5 }}>{RELATION_EMOJI[r]} {r}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ color: t.ink4, fontSize: 11.5, marginTop: 6 }}>You can add as many of each as you like — two Moms, three Grandmas, a Guardian…</Text>

      <Label>Your own wording (optional)</Label>
      <Input value={custom} onChangeText={setCustom} placeholder={relation === "Other" ? "e.g. Godmother, Nanny" : "e.g. Nana, Opa, Auntie"} maxLength={30} />

      {kids.filter((k) => k.id !== existing?.childRef).length > 1 ? (
        <>
          <Label>In the family of</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {kids.filter((k) => k.id !== existing?.childRef).map((k) => {
              const on = families.includes(k.id);
              return (
                <Pressable key={k.id} onPress={() => setFamilies((f) => (f.includes(k.id) ? f.filter((x) => x !== k.id) : [...f, k.id]))} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 4, paddingLeft: 4, paddingRight: 12, borderRadius: 99, borderWidth: 1.5, backgroundColor: on ? t.accentSoft : t.card, borderColor: on ? t.accent : t.line }}>
                  <Avatar child={k} size={26} />
                  <Text style={{ color: on ? t.accentDeep : t.ink3, fontWeight: "700", fontSize: 12.5 }}>{k.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <Label>Profile picture</Label>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Btn label={photoUri ? "Change photo" : "⬆ Choose a photo"} kind="line" onPress={choosePhoto} style={{ flex: 1 }} />
        {photoUri ? <Btn label="Remove" kind="soft" onPress={() => { if (photoUri !== original) deleteFile(photoUri); setPhotoUri(undefined); setCrop(undefined); }} style={{ flex: 0.6 }} /> : null}
      </View>
      {photoUri ? (
        <View style={{ marginTop: 14 }}>
          <AvatarCropper uri={photoUri} value={crop} onChange={setCrop} />
        </View>
      ) : (
        <>
          <Pressable onPress={() => setShowEmoji((v) => !v)}><Text style={{ color: t.ink3, fontWeight: "700", marginTop: 10, textDecorationLine: "underline" }}>{showEmoji ? "Hide emojis" : `Or use an emoji (${emoji})`}</Text></Pressable>
          {showEmoji ? <View style={{ marginTop: 8 }}><EmojiPicker value={emoji} onChange={(e) => { setEmoji(e); setEmojiTouched(true); }} /></View> : null}
        </>
      )}

      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 14 }}>{err}</Text> : null}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
        {existing ? <DeleteButton onPress={remove} /> : <Btn label="Cancel" kind="soft" onPress={discard} />}
        <Btn label={existing ? "Save" : "Add to the family"} onPress={save} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}
