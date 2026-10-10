import React, { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { uid, useActiveChild, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { AvatarCrop, Relative } from "../lib/types";
import { displayName, itemsWithTags, personTag } from "../lib/tags";
import { deleteFile, pickMedia } from "../lib/media";
import { shrinkImage } from "../lib/resize";
import { Avatar, Btn, DeleteButton, Input, Label, MemberAvatar, Sheet } from "./ui";
import { AvatarCropper } from "./AvatarCropper";

/**
 * Add or edit a family member. One form for everyone, in this order: name, photo, relationship (in the family's own words), nickname,
 * a few words about who they are, and whose family they're in.
 */
export function MemberSheet({ memberId, onClose }: { memberId?: string; onClose: () => void }) {
  const t = useTheme();
  const existing = useStore((s) => (memberId ? s.relatives.find((r) => r.id === memberId) : undefined));
  const memories = useStore((s) => s.memories);
  const addRelative = useStore((s) => s.addRelative);
  const updateRelative = useStore((s) => s.updateRelative);
  const removeRelative = useStore((s) => s.removeRelative);
  const setRelativeChildren = useStore((s) => s.setRelativeChildren);
  const kids = useStore((s) => s.kids);
  const active = useActiveChild();

  const [name, setName] = useState(existing?.name ?? "");
  const [relation, setRelation] = useState(existing ? (existing.customLabel?.trim() || existing.relation) : "");
  const [nickname, setNickname] = useState(existing?.nickname ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [photoUri, setPhotoUri] = useState<string | undefined>(existing?.photoUri);
  const [crop, setCrop] = useState<AvatarCrop | undefined>(existing?.crop);
  const [preparing, setPreparing] = useState(false);
  const [err, setErr] = useState("");
  // whose family(ies) this person is in: a new person joins the child you are looking at; someone from before per-child families is in everyone's
  const everyone = kids.map((k) => k.id).filter((id) => id !== existing?.childRef); // someone who IS a child is never in that child's own family
  const startFamilies = existing ? (existing.childIds ?? everyone).filter((id) => id !== existing.childRef) : active ? [active.id] : everyone;
  const [families, setFamilies] = useState<string[]>(startFamilies);
  const original = existing?.photoUri;

  const choosePhoto = async () => {
    const picked = await pickMedia({ videos: false, multiple: false });
    if (!picked.length) return;
    setPreparing(true);
    // a profile picture is only ever shown small: keep a small copy, so lists of people scroll smoothly
    const small = await shrinkImage(picked[0].uri);
    if (small !== picked[0].uri) deleteFile(picked[0].uri);
    setPreparing(false);
    if (photoUri && photoUri !== original) deleteFile(photoUri); // an earlier choice that was never saved
    setPhotoUri(small);
    setCrop(undefined);
  };
  const removePhoto = () => {
    if (photoUri && photoUri !== original) deleteFile(photoUri);
    setPhotoUri(undefined);
    setCrop(undefined);
  };

  const discard = () => {
    if (photoUri && photoUri !== original) deleteFile(photoUri);
    onClose();
  };

  const save = () => {
    if (!name.trim()) return setErr("Add their name.");
    if (!relation.trim()) return setErr("Add how they're related. Example: Mummy");
    if (!families.length) return setErr("Choose at least one child's family, or remove this person.");
    const data: Omit<Relative, "id"> = {
      name: name.trim(), relation: relation.trim(), customLabel: undefined, nickname: nickname.trim() || undefined, description: description.trim() || undefined,
      photoUri, crop: photoUri ? crop : undefined, photoSized: photoUri ? true : undefined,
    };
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
    const shared = (existing.childIds ?? everyone).length > 1 ? " They'll be removed from every child's family. To take them out of just one, untick that child under “In the family of” and save instead." : "";
    Alert.alert(`Remove ${displayName(existing)}?`, (n ? `They'll be taken off the ${n} memor${n === 1 ? "y" : "ies"} they're tagged in. The memories themselves stay.` : "This can't be undone.") + shared, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => { removeRelative(existing.id); onClose(); } },
    ]);
  };

  return (
    <Sheet visible onClose={discard} title={existing ? "Edit family member" : "Add a family member"}>
      <Label>Name</Label>
      <Input value={name} onChangeText={setName} placeholder="Their name" maxLength={40} accessibilityLabel="Name" />

      <Label>Photo (optional)</Label>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <MemberAvatar member={{ photoUri, crop, name: nickname || name, relation }} size={56} />
        {/* Remove on the left, Change photo on the right */}
        {photoUri ? <Btn label="Remove" kind="soft" onPress={removePhoto} style={{ flex: 0.8 }} /> : null}
        <Btn label={preparing ? "Preparing…" : photoUri ? "Change photo" : "Choose a photo"} icon="image" kind="line" onPress={choosePhoto} disabled={preparing} style={{ flex: 1 }} />
      </View>
      {photoUri ? (
        <View style={{ marginTop: 14 }}>
          <AvatarCropper uri={photoUri} value={crop} onChange={setCrop} />
        </View>
      ) : null}

      <Label>Relationship</Label>
      <Input value={relation} onChangeText={setRelation} placeholder="Example: Mummy" maxLength={30} accessibilityLabel="Relationship" />

      <Label>Nickname (optional)</Label>
      <Input value={nickname} onChangeText={setNickname} placeholder="Example: Nana" maxLength={30} accessibilityLabel="Nickname" />

      <Label>Description (optional)</Label>
      <Input value={description} onChangeText={setDescription} placeholder="Example: Lives abroad and visits every summer" multiline maxLength={200} accessibilityLabel="Description" />
      <Text style={{ color: t.ink4, fontSize: 11.5, marginTop: 6 }}>Helps your child understand who this person is when they're older.</Text>

      {kids.filter((k) => k.id !== existing?.childRef).length > 1 ? (
        <>
          <Label>In the family of</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {kids.filter((k) => k.id !== existing?.childRef).map((k) => {
              const on = families.includes(k.id);
              return (
                <Pressable key={k.id} onPress={() => setFamilies((f) => (f.includes(k.id) ? f.filter((x) => x !== k.id) : [...f, k.id]))} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 4, paddingLeft: 4, paddingRight: 12, borderRadius: 99, borderWidth: 1.5, backgroundColor: on ? t.accentSoft : t.card, borderColor: on ? t.accent : t.line }}>
                  <Avatar child={k} size={26} />
                  <Text style={{ color: on ? t.onAccentSoft : t.ink3, fontWeight: "700", fontSize: 12.5 }}>{k.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 14 }}>{err}</Text> : null}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
        {existing ? <DeleteButton onPress={remove} /> : <Btn label="Cancel" kind="soft" onPress={discard} />}
        <Btn label={existing ? "Save" : "Add to the family"} onPress={save} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}
