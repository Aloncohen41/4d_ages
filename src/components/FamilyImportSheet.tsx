import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, ToastAndroid, View } from "react-native";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { Child } from "../lib/types";
import { defaultSelection, importSources, toggleSelection } from "../lib/family";
import { personLabel, relationLabel } from "../lib/tags";
import { Avatar, Btn, MemberAvatar, Sheet } from "./ui";
import { HScroll } from "./HScroll";
import { Icon } from "./Icon";

/**
 * Bring family over from another child. Everyone is marked to begin with; tap someone once to leave them out of THIS child's family
 * (you wouldn't import Maya into Maya's own family as her "Sister", or a relative who is only hers). Then approve.
 * Nothing is copied: the people are added to this child's family as the same person, so their picture and name stay in step.
 */
export function FamilyImportSheet({ visible, onClose, child }: { visible: boolean; onClose: () => void; child: Child }) {
  const t = useTheme();
  const kids = useStore((s) => s.kids);
  const relatives = useStore((s) => s.relatives);
  const importFamily = useStore((s) => s.importFamily);
  const sources = useMemo(() => importSources(relatives, kids, child.id), [relatives, kids, child.id]);
  const [chosen, setChosen] = useState<string | null>(null);
  const src = sources.find((x) => x.child.id === chosen) ?? sources[0];
  const [marked, setMarked] = useState<string[]>([]);

  // each time the window opens, or another child is chosen to import from, everyone is marked again
  useEffect(() => {
    if (visible && src) setMarked(defaultSelection(src));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, src?.child.id]);

  const n = marked.length;
  const approve = () => {
    if (!src || !n) return;
    importFamily(child.id, marked);
    ToastAndroid.show(`${n} ${n === 1 ? "person" : "people"} added to ${child.name}'s family`, ToastAndroid.SHORT);
    onClose();
  };
  const approveButton = <Btn label={n ? `Import ${n} ${n === 1 ? "person" : "people"}` : "Mark who to import"} onPress={approve} disabled={!n} />;

  return (
    <Sheet visible={visible} onClose={onClose} title="Import family">
      {!src ? (
        <Text style={{ color: t.ink3, textAlign: "center", padding: 24 }}>Everyone from the other families is already in {child.name}'s family.</Text>
      ) : (
        <>
          {sources.length > 1 ? (
            <HScroll contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
              {sources.map((x) => {
                const on = x.child.id === src.child.id;
                return (
                  <Pressable key={x.child.id} onPress={() => setChosen(x.child.id)} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5, paddingLeft: 5, paddingRight: 14, borderRadius: 99, borderWidth: 1.5, backgroundColor: on ? t.card : t.bg2, borderColor: on ? t.accent : t.line }}>
                    <Avatar child={x.child} size={28} />
                    <Text style={{ color: t.ink, fontWeight: "700", fontSize: 13 }}>{x.child.name}</Text>
                  </Pressable>
                );
              })}
            </HScroll>
          ) : null}

          <Text style={{ color: t.ink2, fontSize: 14, lineHeight: 20 }}>
            Everyone from {src.child.name}'s family is marked. <Text style={{ fontWeight: "700" }}>Tap someone to leave them out</Text> of {child.name}'s family, then approve.
          </Text>

          <View style={{ marginTop: 14 }}>{approveButton}</View>
          <View style={{ flexDirection: "row", gap: 18, marginTop: 12, marginBottom: 6 }}>
            <Pressable onPress={() => setMarked(src.people.map((p) => p.id))} hitSlop={6}><Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12.5 }}>Mark everyone</Text></Pressable>
            <Pressable onPress={() => setMarked([])} hitSlop={6}><Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12.5 }}>Clear all</Text></Pressable>
          </View>

          {src.people.map((p) => {
            const on = marked.includes(p.id);
            const dup = src.likelyDuplicates.includes(p.id);
            return (
              <Pressable
                key={p.id}
                onPress={() => setMarked((m) => toggleSelection(m, p.id))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={personLabel(p)}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 18, marginTop: 8, borderWidth: 1.5, backgroundColor: on ? t.accentSoft : t.card, borderColor: on ? t.accent : t.line, opacity: on ? 1 : 0.7 }}
              >
                <MemberAvatar member={p} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15 }} numberOfLines={1}>{p.name || relationLabel(p)}</Text>
                  <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12 }} numberOfLines={1}>{relationLabel(p)}</Text>
                  {dup ? <Text style={{ color: t.ink4, fontSize: 11.5, marginTop: 2 }}>Looks like someone already in {child.name}'s family</Text> : null}
                </View>
                <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2.5, borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
                  {on ? <Icon name="check" size={16} color={t.onAccent} /> : null}
                </View>
              </Pressable>
            );
          })}

          {src.people.length > 5 ? <View style={{ marginTop: 18 }}>{approveButton}</View> : null}
        </>
      )}
    </Sheet>
  );
}
