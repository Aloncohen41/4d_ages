import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { uid, useActiveChild, useStore } from "../lib/store";
import { familyOf } from "../lib/family";
import { useTheme } from "../lib/useTheme";
import { TAG_CATEGORIES, displayName, implicitPlace, indexTags, personTag, relationLabel, tagStats, tagsFromText, uniqueIds } from "../lib/tags";
import { Tag, TagCategory } from "../lib/types";
import { Btn, Input, MemberAvatar, Seg } from "./ui";
import { TagChip } from "./TagChip";
import { Icon } from "./Icon";

/**
 * The one tag editor used everywhere (photos, stories, milestones, firsts, lasts, measurements, imports).
 * It edits a list of tag ids; the tags themselves live in the central list.
 */
export function TagPicker({ value, onChange, location }: { value: string[]; onChange: (ids: string[]) => void; location?: string }) {
  const t = useTheme();
  const relatives = useStore((s) => s.relatives);
  const active = useActiveChild();
  const family = useMemo(() => (active ? familyOf(relatives, active.id) : relatives), [relatives, active]); // the people in THIS child's family
  const memories = useStore((s) => s.memories);
  const list = useStore((s) => s.tags);
  const upsertTags = useStore((s) => s.upsertTags);
  const addRelative = useStore((s) => s.addRelative);
  const [newPerson, setNewPerson] = useState(false);
  const [personName, setPersonName] = useState("");
  const [personRel, setPersonRel] = useState("");
  const [category, setCategory] = useState<TagCategory>(family.length ? "person" : "event");
  const [draft, setDraft] = useState("");

  const stats = useMemo(() => tagStats(memories, list, relatives), [memories, list, relatives]);
  const index = useMemo(() => indexTags(list), [list]);
  const suggestions = stats.filter((s) => s.category === category && !value.includes(s.id)).slice(0, 8);
  const place = implicitPlace({ location });

  const toggle = (tag: Tag) => {
    if (value.includes(tag.id)) return onChange(value.filter((x) => x !== tag.id));
    upsertTags([tag]); // make sure it's in the central list
    onChange(uniqueIds([...value, tag.id]));
  };
  const add = (text: string) => {
    const created = tagsFromText(category, text);
    if (created.length) {
      upsertTags(created);
      onChange(uniqueIds([...value, ...created.map((x) => x.id)]));
    }
    setDraft("");
  };
  /** Add someone to the family right here and tag them in this post. */
  const addPerson = () => {
    const name = personName.trim();
    if (!name || !personRel.trim()) return;
    const member = { id: uid("rel"), name, relation: personRel.trim(), childIds: active ? [active.id] : undefined };
    addRelative(member);
    const tag = personTag(member);
    upsertTags([tag]);
    onChange(uniqueIds([...value, tag.id]));
    setPersonName("");
    setPersonRel("");
    setNewPerson(false);
  };
  const chosen = value.map((id) => index.get(id) ?? (stats.find((s) => s.id === id)?.tag)).filter((x): x is Tag => !!x);

  return (
    <View>
      {chosen.length || place ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {place && !value.includes(place.id) ? <TagChip tag={place} muted /> : null}
          {chosen.map((tg) => (
            <TagChip key={tg.id} tag={tg} onRemove={() => toggle(tg)} />
          ))}
        </View>
      ) : null}

      <Seg options={TAG_CATEGORIES.map((k) => ({ id: k.id, label: k.short }))} value={category} onChange={setCategory} />

      {category === "person" ? (
        <View style={{ marginTop: 10 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {family.map((r) => {
              const tag = personTag(r);
              const on = value.includes(tag.id);
              return (
                <Pressable key={r.id} onPress={() => toggle(tag)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingLeft: 4, paddingRight: 12, borderRadius: 12, backgroundColor: on ? t.chipOn : t.card, borderWidth: 1, borderColor: on ? t.chipOn : t.line }}>
                  <MemberAvatar member={r} size={26} />
                  <Text style={{ color: on ? t.onChipOn : t.ink2, fontWeight: "700", fontSize: 12.5 }}>{displayName(r)}{"  "}<Text style={{ fontWeight: "600", opacity: 0.8 }}>{relationLabel(r)}</Text></Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => setNewPerson((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9, paddingHorizontal: 13, borderRadius: 99, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.accent }}>
              <Icon name="user-plus" size={14} color={t.accentDeep} />
              <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12.5 }}>New person</Text>
            </Pressable>
          </View>
          {newPerson ? (
            <View style={{ marginTop: 10, backgroundColor: t.bg2, borderRadius: 14, padding: 12, gap: 8 }}>
              <Input value={personName} onChangeText={setPersonName} placeholder="Their name" maxLength={40} returnKeyType="done" onSubmitEditing={addPerson} />
              <Input value={personRel} onChangeText={setPersonRel} placeholder="Relationship. Example: Mummy" maxLength={30} returnKeyType="done" onSubmitEditing={addPerson} />
              <Btn label="Add to the family and tag them" onPress={addPerson} disabled={!personName.trim() || !personRel.trim()} style={{ paddingVertical: 11 }} />
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ marginTop: 10 }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Input
                value={draft}
                onChangeText={(v) => (/[,\n]$/.test(v) ? add(v) : setDraft(v))}
                onSubmitEditing={() => add(draft)}
                placeholder={category === "event" ? "Example: First birthday party" : category === "place" ? "Example: Grandma's house" : "Example: Beach"}
                returnKeyType="done"
                blurOnSubmit={false}
              />
            </View>
            <Btn label="Add" onPress={() => add(draft)} disabled={!draft.trim()} style={{ paddingVertical: 12, paddingHorizontal: 16 }} />
          </View>
          {suggestions.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {suggestions.map((s) => (
                <Pressable key={s.id} onPress={() => toggle(s.tag)} style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: 99, borderWidth: 1, borderColor: t.line, backgroundColor: t.card }}>
                  <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12 }}>+ {s.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}
