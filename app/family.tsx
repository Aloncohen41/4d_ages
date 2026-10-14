import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, PanResponder, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Page } from "../src/components/Page";
import { Btn, Input, MemberAvatar } from "../src/components/ui";
import { Icon } from "../src/components/Icon";
import { FamilyImportSheet } from "../src/components/FamilyImportSheet";
import { MemberSheet } from "../src/components/MemberSheet";
import { dropIndex, familyOf, importSources, moveInOrder, moveTo, orderedFamily, searchFamily } from "../src/lib/family";
import { useShownChild, useStore } from "../src/lib/store";
import { useTheme } from "../src/lib/useTheme";
import { displayName, itemsWithTags, personTag, relationLine } from "../src/lib/tags";
import { sideLabel } from "../src/lib/kinship";
import { shrinkImage } from "../src/lib/resize";
import { deleteFile } from "../src/lib/media";
import { withAlpha } from "../src/lib/m3";
import { TYPE } from "../src/theme";

/**
 * Everyone in the child's family as one compact list: search at the top, one "Add someone" button, rows you can reorder (drag the handle, or
 * use the arrows) and remove. Tapping a person opens their page, with everything they're in.
 */
export default function FamilyPage() {
  const t = useTheme();
  const child = useShownChild();
  const relatives = useStore((s) => s.relatives);
  const kids = useStore((s) => s.kids);
  const memories = useStore((s) => s.memories);
  const order = useStore((s) => (child ? s.familyOrder[child.id] : undefined));
  const setFamilyOrder = useStore((s) => s.setFamilyOrder);
  const removeRelative = useStore((s) => s.removeRelative);
  const updateRelative = useStore((s) => s.updateRelative);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<{ memberId?: string; pet?: boolean } | null>(null);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  // dragging a row: which one, how far it has moved, and where every row sits (to work out where it lands)
  const [drag, setDrag] = useState<{ id: string; dy: number } | null>(null);
  const rows = useRef(new Map<string, { y: number; h: number }>());
  const handles = useRef(new Map<string, ReturnType<typeof PanResponder.create>>());
  const latest = useRef<{ landing: (id: string, dy: number) => number; ids: string[]; childId: string } | null>(null);

  // each child has their own family; people can be in several children's families
  const family = useMemo(() => (child ? orderedFamily(familyOf(relatives, child.id), order) : []), [relatives, child, order]);
  const shown = useMemo(() => searchFamily(family, query), [family, query]);
  const sources = useMemo(() => (child ? importSources(relatives, kids, child.id) : []), [relatives, kids, child]);
  const importFrom = sources.length === 1 ? sources[0].child.name : "another child";

  // pictures added before they were scaled down are made small once, quietly, so the list scrolls smoothly
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const r of family.filter((x) => x.photoUri && !x.photoSized)) {
        const small = await shrinkImage(r.photoUri as string);
        if (!alive) { if (small !== r.photoUri) deleteFile(small); return; }
        updateRelative(r.id, { photoUri: small, photoSized: true });
        if (small !== r.photoUri) deleteFile(r.photoUri as string);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family.map((r) => `${r.id}:${r.photoSized ? 1 : 0}`).join()]);

  if (!child) return null;
  const move = (id: string, by: -1 | 1) => setFamilyOrder(child.id, moveInOrder(family.map((r) => r.id), id, by));
  const ids = family.map((r) => r.id);
  const mids = ids.map((id) => { const r = rows.current.get(id); return r ? r.y + r.h / 2 : 0; });
  const landing = (id: string, dy: number) => dropIndex(mids, ids.indexOf(id), mids[ids.indexOf(id)] + dy);
  latest.current = { landing, ids, childId: child.id };
  // one gesture handler per row, made once (a new one mid-drag would lose track of the finger); it reads the current list through `latest`
  const handle = (id: string) => {
    let h = handles.current.get(id);
    if (!h) {
      h = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false, // the page doesn't scroll while a row is held
        onPanResponderGrant: () => setDrag({ id, dy: 0 }),
        onPanResponderMove: (_e, g) => setDrag({ id, dy: g.dy }),
        onPanResponderRelease: (_e, g) => {
          setDrag(null);
          const cur = latest.current;
          if (!cur) return;
          const to = cur.landing(id, g.dy);
          if (to !== cur.ids.indexOf(id)) setFamilyOrder(cur.childId, moveTo(cur.ids, id, to));
        },
        onPanResponderTerminate: () => setDrag(null),
      });
      handles.current.set(id, h);
    }
    return h;
  };
  const dropAt = drag ? landing(drag.id, drag.dy) : -1;
  const remove = (id: string) => {
    const r = family.find((x) => x.id === id);
    if (!r) return;
    const n = itemsWithTags(memories, [personTag(r).id]).length;
    Alert.alert(`Remove ${displayName(r)}?`, n ? `They'll be taken off the ${n} memor${n === 1 ? "y" : "ies"} they're tagged in. The memories themselves stay.` : "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeRelative(id) },
    ]);
  };
  const open = (id: string) => {
    setSelected(id);
    router.push({ pathname: "/person/[id]", params: { id } });
  };

  return (
    <Page
      title={`${child.name}'s family`}
      right={family.length ? (
        <Pressable onPress={() => setEditing((e) => !e)} hitSlop={6} accessibilityRole="button" style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>{editing ? "Done" : "Edit"}</Text>
        </Pressable>
      ) : null}
    >
      {family.length > 1 ? (
        <View style={{ marginBottom: 12 }}>
          <Input value={query} onChangeText={setQuery} placeholder="Search by name, nickname or relationship" accessibilityLabel="Search family" autoCorrect={false} style={{ paddingLeft: 44 }} />
          <View pointerEvents="none" style={{ position: "absolute", left: 14, top: 0, bottom: 0, justifyContent: "center" }}><Icon name="search" size={20} color={t.ink3} /></View>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Btn label="Add someone" icon="plus" onPress={() => setSheet({})} style={{ flex: 1 }} />
        <Btn label="Add a pet" icon="paw" kind="soft" onPress={() => setSheet({ pet: true })} style={{ flex: 1 }} />
      </View>

      {sources.length ? (
        <Pressable onPress={() => setImporting(true)} accessibilityLabel={`Import family from ${importFrom}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: t.outline }}>
          <Icon name="download" size={20} color={t.ink2} />
          <Text style={[TYPE.labelLarge, { color: t.ink, flex: 1 }]}>Import family from {importFrom}</Text>
          <Icon name="chevron-right" size={20} color={t.ink3} />
        </Pressable>
      ) : null}

      {family.length === 0 ? (
        <View style={{ alignItems: "center", padding: 28 }}>
          <Icon name="family" size={40} color={t.ink3} />
          <Text style={{ color: t.ink3, textAlign: "center", marginTop: 6 }}>No one in {child.name}'s family yet. Add someone to start.</Text>
        </View>
      ) : shown.length === 0 ? (
        <Text style={{ color: t.ink3, textAlign: "center", padding: 24 }}>No one matches “{query.trim()}”.</Text>
      ) : (
        <View style={{ marginTop: 16, gap: 8 }}>
          {shown.map((r) => {
            const on = r.id === selected;
            const i = family.findIndex((x) => x.id === r.id);
            const held = drag?.id === r.id;
            const canDrag = editing && !query.trim() && family.length > 1;
            const from = drag ? ids.indexOf(drag.id) : -1;
            // a line where the held row will land
            const lineAbove = drag && !held && i === dropAt && dropAt < from;
            const lineBelow = drag && !held && i === dropAt && dropAt > from;
            return (
              <View key={r.id} onLayout={(e) => rows.current.set(r.id, { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}
                style={{ zIndex: held ? 2 : 0, transform: held ? [{ translateY: drag.dy }] : undefined, elevation: held ? 6 : 0 }}>
              {lineAbove ? <View style={{ height: 3, borderRadius: 2, backgroundColor: t.accent, marginBottom: 4 }} /> : null}
              {/* selection is an outline: the row's colours (and so its contrast) never change */}
              <Pressable
                onPress={() => (editing ? setSheet({ memberId: r.id }) : open(r.id))}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                android_ripple={{ color: withAlpha(t.ink, 0.08) }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 16, backgroundColor: t.card, borderWidth: on ? 2 : 1, borderColor: on ? t.accent : t.line, overflow: "hidden" }}
              >
                <MemberAvatar member={r} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={[TYPE.titleSmall, { color: t.ink }]} numberOfLines={1}>{displayName(r)}</Text>
                  {(() => {
                    // whose side they're on, so two grandmas (or two uncles) are told apart; a gentle nudge where it isn't known yet
                    const side = sideLabel(r, family);
                    return (
                      <Text style={[TYPE.bodySmall, { color: t.ink2 }]} numberOfLines={1}>
                        {relationLine(r)}{side ? ` · ${side}` : ""}
                        {side === null ? <Text style={{ color: t.accentDeep, fontWeight: "700" }}> · Choose whose side</Text> : null}
                      </Text>
                    );
                  })()}
                  {r.description ? <Text style={[TYPE.bodySmall, { color: t.ink3 }]} numberOfLines={1}>{r.description}</Text> : null}
                </View>
                {editing ? (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {canDrag ? (
                      <View {...handle(r.id).panHandlers} accessibilityLabel={`Drag to move ${displayName(r)}`} hitSlop={8} style={{ padding: 6 }}>
                        <Icon name="drag" size={22} color={held ? t.accent : t.ink2} />
                      </View>
                    ) : null}
                    {!query.trim() ? (
                      <>
                        <Pressable onPress={() => move(r.id, -1)} disabled={i === 0} accessibilityLabel={`Move ${displayName(r)} up`} hitSlop={4} style={{ padding: 6, opacity: i === 0 ? 0.3 : 1 }}><Icon name="arrow-up" size={20} color={t.ink2} /></Pressable>
                        <Pressable onPress={() => move(r.id, 1)} disabled={i === family.length - 1} accessibilityLabel={`Move ${displayName(r)} down`} hitSlop={4} style={{ padding: 6, opacity: i === family.length - 1 ? 0.3 : 1 }}><Icon name="arrow-down" size={20} color={t.ink2} /></Pressable>
                      </>
                    ) : null}
                    <Pressable onPress={() => remove(r.id)} accessibilityLabel={`Remove ${displayName(r)}`} hitSlop={4} style={{ padding: 6 }}><Icon name="trash-2" size={20} color={t.danger} /></Pressable>
                  </View>
                ) : (
                  <Icon name="chevron-right" size={20} color={t.ink3} />
                )}
              </Pressable>
              {lineBelow ? <View style={{ height: 3, borderRadius: 2, backgroundColor: t.accent, marginTop: 4 }} /> : null}
              </View>
            );
          })}
          {editing ? <Text style={[TYPE.bodySmall, { color: t.ink3, textAlign: "center", marginTop: 4 }]}>Drag a handle (or use the arrows) to change the order. Tap someone to edit them.</Text> : null}
        </View>
      )}

      {sheet ? <MemberSheet key={sheet.memberId ?? (sheet.pet ? "new-pet" : "new")} memberId={sheet.memberId} pet={sheet.pet} onClose={() => setSheet(null)} /> : null}
      <FamilyImportSheet visible={importing} onClose={() => setImporting(false)} child={child} />
    </Page>
  );
}
