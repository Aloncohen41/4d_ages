import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { Btn, Heading, MemberAvatar } from "../../src/components/ui";
import { Icon } from "../../src/components/Icon";
import { FamilyImportSheet } from "../../src/components/FamilyImportSheet";
import { familyOf, importSources, needsSiblingSetup } from "../../src/lib/family";
import { MemberSheet } from "../../src/components/MemberSheet";
import { TagResults } from "../../src/components/TagBrowser";
import { useShownChild, useStore } from "../../src/lib/store";
import { useTheme } from "../../src/lib/useTheme";
import { RELATION_EMOJI } from "../../src/lib/types";
import { itemsWithTags, personLabel, personTag, relationLabel } from "../../src/lib/tags";

export default function FamilyTab() {
  return (
    <Screen>
      <Family />
    </Screen>
  );
}

// quick starts; every one can be added as many times as needed
const QUICK = ["Mom", "Dad", "Guardian", "Grandma", "Grandpa", "Sister", "Brother"];

function Family() {
  const t = useTheme();
  const child = useShownChild();
  const relatives = useStore((s) => s.relatives);
  const kids = useStore((s) => s.kids);
  const memories = useStore((s) => s.memories);
  const setTagSheet = useStore((s) => s.setTagSheet);
  const [sel, setSel] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ memberId?: string; preset?: string } | null>(null);
  const [importing, setImporting] = useState(false);

  // each child has their own family; people can be in several children's families
  const family = useMemo(() => (child ? familyOf(relatives, child.id) : []), [relatives, child]);
  const sources = useMemo(() => (child ? importSources(relatives, kids, child.id) : []), [relatives, kids, child]);
  const importFrom = sources.length === 1 ? sources[0].child.name : "another child";
  const setupSiblings = useStore((s) => s.setupSiblings);
  const offerSiblings = needsSiblingSetup(relatives, kids); // several children, but nobody set up as a sibling yet

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    if (!child) return out;
    const mine = memories.filter((p) => p.childId === child.id);
    for (const r of family) out[r.id] = itemsWithTags(mine, [personTag(r).id]).length;
    return out;
  }, [memories, family, child]);

  if (!child) return null;
  const selected = family.find((r) => r.id === sel);

  return (
    <View>
      <Heading title="Family" desc={`Everyone who's part of ${child.name}'s life — as many of each as you like. Tag them on any photo, story or milestone to see everything they're in.`} />

      <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>Add someone</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {QUICK.map((r) => (
          <Pressable key={r} onPress={() => setSheet({ preset: r })} style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 99, backgroundColor: t.accentSoft }}>
            <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12.5 }}>＋ {RELATION_EMOJI[r]} {r}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setSheet({ preset: "Other" })} style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 99, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.accent }}>
          <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12.5 }}>＋ Someone else…</Text>
        </Pressable>
      </View>

      {offerSiblings ? (
        <Pressable onPress={setupSiblings} accessibilityLabel="Set up siblings" style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, padding: 12, borderRadius: 16, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.line }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }}><Icon name="heart" size={17} color={t.accentDeep} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontWeight: "700", fontSize: 14.5 }}>Set up siblings</Text>
            <Text style={{ color: t.ink3, fontSize: 12 }}>Adds each child to the others' families — Sister for pink, Brother for blue, Sibling for green.</Text>
          </View>
        </Pressable>
      ) : null}

      {sources.length ? (
        <Pressable onPress={() => setImporting(true)} accessibilityLabel={`Import family from ${importFrom}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, padding: 12, borderRadius: 16, backgroundColor: t.accentSoft, borderWidth: 1.5, borderColor: t.accent }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" }}><Icon name="download" size={17} color={t.onAccent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 14.5 }}>Import family from {importFrom}</Text>
            <Text style={{ color: t.ink3, fontSize: 12 }}>Choose who to bring over — everyone is marked to begin with.</Text>
          </View>
        </Pressable>
      ) : null}

      {family.length === 0 ? (
        <View style={{ alignItems: "center", padding: 28 }}>
          <Text style={{ fontSize: 40 }}>👪</Text>
          <Text style={{ color: t.ink3, textAlign: "center", marginTop: 6 }}>No one in {child.name}'s family yet. {sources.length ? "Import from above, or add" : "Start with Mom or Dad above, or add"} someone new.</Text>
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
          {family.map((r) => {
            const on = r.id === sel;
            return (
              <Pressable key={r.id} onPress={() => setSel(on ? null : r.id)} style={{ width: "48.5%", backgroundColor: on ? t.chipOn : t.card, borderRadius: 18, borderWidth: 1, borderColor: on ? t.chipOn : t.line, padding: 12, alignItems: "center" }}>
                <MemberAvatar member={r} size={64} ring={on} />
                <Text style={{ color: on ? t.onChipOn : t.ink, fontWeight: "700", fontSize: 14.5, marginTop: 8, textAlign: "center" }} numberOfLines={1}>{r.name || relationLabel(r)}</Text>
                <Text style={{ color: on ? t.bg3 : t.ink3, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>{relationLabel(r)}</Text>
                <Text style={{ color: on ? t.bg3 : t.accentDeep, fontSize: 11.5, fontWeight: "700", marginTop: 3 }}>{counts[r.id] || 0} {counts[r.id] === 1 ? "memory" : "memories"}</Text>
                <Pressable onPress={() => setSheet({ memberId: r.id })} hitSlop={8} style={{ position: "absolute", right: 8, top: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: on ? "#ffffff30" : t.bg2, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: on ? t.onChipOn : t.ink3, fontSize: 12 }}>✎</Text>
                </Pressable>
              </Pressable>
            );
          })}
        </View>
      )}

      {selected ? (
        <View style={{ marginTop: 22 }}>
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 18, marginBottom: 4 }}>{child.name} with {personLabel(selected)}</Text>
          <Text style={{ color: t.ink3, fontSize: 12.5, marginBottom: 10 }}>Photos, stories, milestones, firsts, lasts and measurements they're tagged in.</Text>
          <TagResults keys={[personTag(selected).id]} childId={child.id} />
          <Btn label="Open in Tags & search" kind="line" onPress={() => setTagSheet({ keys: [personTag(selected).id] })} style={{ marginTop: 6, paddingVertical: 10 }} />
        </View>
      ) : null}

      {sheet ? <MemberSheet key={sheet.memberId ?? sheet.preset} memberId={sheet.memberId} presetRelation={sheet.preset} onClose={() => setSheet(null)} /> : null}
      <FamilyImportSheet visible={importing} onClose={() => setImporting(false)} child={child} />
    </View>
  );
}
