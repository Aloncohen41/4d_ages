import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Child } from "../lib/types";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { todayISO } from "../lib/date";
import { PET_FIRST_IDEAS, TRICK_IDEAS, speciesInfo } from "../lib/pets";
import { TYPE } from "../theme";
import { Icon } from "./Icon";

/** Tricks are kept as firsts with this source, so they're in the story, the videos and the book like any first. */
export const TRICK_SOURCE = "Trick";

/**
 * On a pet's Home: their tricks (tap one to tick it off today, tap a ticked one to add a photo or change the day) and firsts to remember.
 * No "lasts" for pets: anything like that is simply a story.
 */
export function PetTricks({ child, open: always = false }: { child: Child; open?: boolean }) {
  const t = useTheme();
  const memories = useStore((s) => s.memories);
  const saveMemory = useStore((s) => s.saveMemory);
  const setEntrySheet = useStore((s) => s.setEntrySheet);
  const [opened, setOpen] = useState(false);
  const open = always || opened;
  const species = speciesInfo(child.species).id;
  const learned = useMemo(() => new Map(memories.filter((m) => m.childId === child.id && m.source === TRICK_SOURCE).map((m) => [(m.title ?? "").toLowerCase(), m])), [memories, child.id]);
  const firsts = useMemo(() => new Set(memories.filter((m) => m.childId === child.id && m.type === "first").map((m) => (m.title ?? "").toLowerCase())), [memories, child.id]);
  if (child.role === "viewer") return null;
  const tricks = TRICK_IDEAS[species];
  const done = tricks.filter((x) => learned.has(x.toLowerCase())).length;
  const ideas = PET_FIRST_IDEAS[species].filter((x) => !firsts.has(x.toLowerCase()));

  const tick = (trick: string) => {
    const m = learned.get(trick.toLowerCase());
    if (m) return setEntrySheet({ kind: "first", editId: m.id }); // a photo, a few words, or another day
    saveMemory({ childId: child.id, type: "first", title: trick, description: "", date: todayISO(), media: [], tagIds: [], emoji: "🎓", source: TRICK_SOURCE });
    useStore.getState().celebrate(`🎓 ${child.name} learned “${trick}”!`);
  };
  const chip = (on: boolean) => ({ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, backgroundColor: on ? t.chipOn : t.bg2 } as const);

  return (
    <View style={{ backgroundColor: t.card, borderRadius: 18, borderWidth: 1, borderColor: t.line, padding: 14, marginBottom: 12 }}>
      <Pressable onPress={() => !always && setOpen((v) => !v)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ fontSize: 24 }}>🎓</Text>
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.titleSmall, { color: t.ink }]}>Tricks & firsts</Text>
          <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{done} of {tricks.length} tricks · {firsts.size} {firsts.size === 1 ? "first" : "firsts"}</Text>
        </View>
        {!always ? <Icon name={open ? "chevron-up" : "chevron-down"} size={22} color={t.ink2} /> : null}
      </Pressable>
      {open ? (
        <>
          <Text style={[TYPE.labelMedium, { color: t.ink3, marginTop: 12, marginBottom: 6 }]}>Tricks (tap when they've learned one)</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {tricks.map((x) => {
              const on = learned.has(x.toLowerCase());
              return (
                <Pressable key={x} onPress={() => tick(x)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={chip(on)}>
                  {on ? <Icon name="check" size={14} color={t.onChipOn} /> : null}
                  <Text style={{ color: on ? t.onChipOn : t.ink2, fontWeight: "700", fontSize: 12.5 }}>{x}</Text>
                </Pressable>
              );
            })}
          </View>
          {ideas.length ? (
            <>
              <Text style={[TYPE.labelMedium, { color: t.ink3, marginTop: 14, marginBottom: 6 }]}>Firsts to remember</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {ideas.map((x) => (
                  <Pressable key={x} onPress={() => setEntrySheet({ kind: "first", title: x })} style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99, backgroundColor: t.accentSoft }}>
                    <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12.5 }}>{x}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
