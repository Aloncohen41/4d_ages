import React, { useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, Text, View } from "react-native";
import { Page } from "../src/components/Page";
import { Avatar, Btn, MemberAvatar, Sheet } from "../src/components/ui";
import { Icon } from "../src/components/Icon";
import { familyOf } from "../src/lib/family";
import { LINK_WORDS, Link, ME, Row, connect, isCouple, kinOf, linkChoices, placeInRow, separate, sideChoices, treeLayout } from "../src/lib/kinship";
import { useShownChild, useStore } from "../src/lib/store";
import { useTheme } from "../src/lib/useTheme";
import { displayName, relationLine } from "../src/lib/tags";
import { withAlpha } from "../src/lib/m3";
import { Child, Relative } from "../src/lib/types";
import { TYPE } from "../src/theme";

import { tr } from "../src/lib/i18n";
/*
 * The family tree, built by hand. Press and hold someone and drag them:
 *  - next to another person, to join them ("Ruth is Dana's… mother or father / partner / brother or sister / son or daughter"), which sets
 *    who they are to the child, their side and who they're with;
 *  - onto an empty part of a row, to put them in that generation, on that side.
 * Two parents (or two grandparents on one side) are taken to be together; a long press on the ♥ between a couple separates them. Pets
 * always sit at the far end of the child's row. Tapping someone offers the same choices without dragging (and works with a keyboard).
 */
type Zone = { row: Exclude<Row, "other">; side: 0 | 1 | null };
type Target = Relative | typeof ME;
const zoneKey = (z: Zone) => `${z.row}:${z.side ?? "mid"}`;

const ROW_TITLES: Record<Exclude<Row, "other">, string> = {
  great: "Great-grandparents",
  grand: "Grandparents",
  parent: "Parents, aunts and uncles",
  same: "Brothers, sisters and cousins",
};

/** The rows someone can be moved to from the tap menu: a generation, and the side (null: not on a side). */
const PLACES: [Exclude<Row, "other">, 0 | 1 | null, string][] = [
  ["great", 0, "Great-grandparent"], ["great", 1, "Great-grandparent"],
  ["grand", 0, "Grandparent"], ["grand", 1, "Grandparent"],
  ["parent", null, "Parent"], ["parent", 0, "Aunt or uncle"], ["parent", 1, "Aunt or uncle"],
  ["same", null, "Brother or sister"], ["same", 0, "Cousin"], ["same", 1, "Cousin"],
];

export default function TreePage() {
  const t = useTheme();
  const child = useShownChild();
  const relatives = useStore((s) => s.relatives);
  const updateRelative = useStore((s) => s.updateRelative);
  const family = useMemo(() => (child ? familyOf(relatives, child.id).filter((r) => r.childRef !== child.id) : []), [relatives, child]);
  const L = useMemo(() => treeLayout(family), [family]);

  // where everything is on screen (measured when someone is dropped), and the person being carried
  const root = useRef<View>(null);
  const nodes = useRef(new Map<string, View | null>());
  const zones = useRef(new Map<string, View | null>());
  const [carry, setCarry] = useState<{ id: string; x: number; y: number } | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const [ask, setAsk] = useState<{ who: Relative; target?: Target } | null>(null);
  const latest = useRef({ family, child });
  latest.current = { family, child };

  const apply = (patches: { id: string; patch: Partial<Relative> }[]) => patches.forEach((p) => updateRelative(p.id, p.patch));

  const measure = (v: View | null | undefined) =>
    new Promise<{ x: number; y: number; w: number; h: number } | null>((res) => (v ? v.measureInWindow((x, y, w, h) => res({ x, y, w, h })) : res(null)));

  /** Where the carried person was let go: next to someone (ask how they're joined), or on an empty part of a row (move them there). */
  const drop = async (id: string, px: number, py: number) => {
    const { family: fam } = latest.current;
    const who = fam.find((r) => r.id === id);
    if (!who) return;
    let best: { target: Target; d: number } | null = null;
    for (const [nid, v] of nodes.current) {
      if (nid === id) continue;
      const b = await measure(v);
      if (!b) continue;
      const d = Math.hypot(b.x + b.w / 2 - px, b.y + b.h / 2 - py);
      if (d < 70 && (!best || d < best.d)) best = { target: nid === ME ? ME : fam.find((r) => r.id === nid)!, d };
    }
    if (best?.target) {
      if (linkChoices(best.target, fam).length) setAsk({ who, target: best.target });
      return;
    }
    for (const [key, v] of zones.current) {
      const b = await measure(v);
      if (b && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
        const [row, side] = key.split(":");
        apply(placeInRow(who, row as Zone["row"], side === "mid" ? null : (Number(side) as 0 | 1), fam));
        return;
      }
    }
  };

  // one gesture handler per person, made once: a short press is a tap, a long press picks them up
  const handlers = useRef(new Map<string, ReturnType<typeof PanResponder.create>>());
  const handler = (id: string) => {
    let h = handlers.current.get(id);
    if (h) return h;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lifted = false;
    let moved = false;
    h = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => !lifted, // until they're picked up, the page can still scroll
      onPanResponderGrant: (e) => {
        lifted = false; moved = false;
        const { pageX, pageY } = e.nativeEvent;
        timer = setTimeout(async () => {
          lifted = true;
          const b = await measure(root.current);
          origin.current = { x: b?.x ?? 0, y: b?.y ?? 0 };
          setCarry({ id, x: pageX, y: pageY });
        }, 380);
      },
      onPanResponderMove: (e, g) => {
        if (!lifted) { if (Math.abs(g.dx) + Math.abs(g.dy) > 10) { moved = true; if (timer) clearTimeout(timer); } return; }
        setCarry({ id, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
      },
      onPanResponderRelease: (e) => {
        if (timer) clearTimeout(timer);
        if (lifted) { setCarry(null); drop(id, e.nativeEvent.pageX, e.nativeEvent.pageY); }
        else if (!moved) { const who = latest.current.family.find((r) => r.id === id); if (who) setAsk({ who }); }
        lifted = false;
      },
      onPanResponderTerminate: () => { if (timer) clearTimeout(timer); lifted = false; setCarry(null); },
    });
    handlers.current.set(id, h);
    return h;
  };

  if (!child) return null;
  const carried = carry ? family.find((r) => r.id === carry.id) : undefined;

  const node = (r: Relative) => (
    <View key={r.id} ref={(v) => { nodes.current.set(r.id, v); }} {...handler(r.id).panHandlers} accessible accessibilityRole="button" accessibilityLabel={tr("{0}, {1}. Press to connect or move", [displayName(r), relationLine(r)])}
      style={{ alignItems: "center", width: 84, opacity: carry?.id === r.id ? 0.3 : 1, cursor: "grab" } as object}>
      <MemberAvatar member={r} size={52} />
      <Text style={[TYPE.labelMedium, { color: t.ink, marginTop: 4, textAlign: "center" }]} numberOfLines={1}>{displayName(r)}</Text>
      <Text style={[TYPE.labelSmall, { color: t.ink3, textAlign: "center" }]} numberOfLines={1}>{kinOf(r) === "pet" ? tr("Pet") : relationLine(r)}</Text>
    </View>
  );
  // couples side by side with a ♥ between them; a long press on the ♥ separates them
  const group = (list: Relative[]) => {
    const out: React.ReactNode[] = [];
    for (let k = 0; k < list.length; k++) {
      const a = list[k], b = list[k + 1];
      if (b && isCouple(a, b, family)) {
        out.push(
          <View key={a.id} style={{ flexDirection: "row", alignItems: "flex-start" }}>
            {node(a)}
            <Pressable onLongPress={() => apply(separate(a, b))} delayLongPress={450} accessibilityRole="button" accessibilityLabel={tr("{0} and {1} are together. Press and hold to separate them", [displayName(a), displayName(b)])}
              style={{ marginTop: 16, width: 26, height: 22, alignItems: "center", justifyContent: "center" }}>
              <View style={{ position: "absolute", left: -6, right: -6, top: 10, height: 2, backgroundColor: withAlpha(t.accent, 0.5) }} />
              <Text style={{ color: t.accent, fontSize: 14 }}>♥</Text>
            </Pressable>
            {node(b)}
          </View>,
        );
        k++;
      } else out.push(node(a));
    }
    return out;
  };
  const column = (z: Zone, list: Relative[], extra?: React.ReactNode) => (
    <View key={zoneKey(z)} ref={(v) => { zones.current.set(zoneKey(z), v); }} style={{ flex: 1, minHeight: list.length || extra ? 96 : 52, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignContent: "flex-start", gap: 6, padding: 6, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: carry ? withAlpha(t.accent, 0.5) : "transparent", backgroundColor: carry ? withAlpha(t.accent, 0.04) : "transparent" }}>
      {group(list)}
      {extra}
    </View>
  );
  const sided = !!L.sides;
  const rowView = (row: Exclude<Row, "other">) => {
    const r = L[row];
    const me = row === "same" ? (
      <View key="me" ref={(v) => { nodes.current.set(ME, v); }} style={{ alignItems: "center", width: 84 }} accessible accessibilityLabel={tr("{0}, that's who the tree is for", [child.name])}>
        <Avatar child={child as Child} size={60} ring />
        <Text style={[TYPE.labelMedium, { color: t.ink, marginTop: 4, fontWeight: "700" }]} numberOfLines={1}>{child.name}</Text>
      </View>
    ) : null;
    const pets = row === "same" ? group(L.pets) : null;
    // the two parents sit at the inner edge of their own sides: what joins them is shown in the middle, between them
    const ps = family.filter((x) => kinOf(x) === "parent");
    const bond = row === "parent" && sided && ps.length === 2 && isCouple(ps[0], ps[1], family) ? (
      <Pressable key="bond" onLongPress={() => apply(separate(ps[0], ps[1]))} delayLongPress={450} accessibilityRole="button" accessibilityLabel={tr("{0} and {1} are together. Press and hold to separate them", [displayName(ps[0]), displayName(ps[1])])}
        style={{ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6 }}>
        <View style={{ width: 40, height: 2, backgroundColor: withAlpha(t.accent, 0.5) }} />
        <Text style={{ color: t.accent, fontSize: 16 }}>♥</Text>
        <View style={{ width: 40, height: 2, backgroundColor: withAlpha(t.accent, 0.5) }} />
      </Pressable>
    ) : null;
    return (
      <View key={row} style={{ marginBottom: 18 }}>
        <Text role="heading" aria-level={2} style={[TYPE.titleSmall, { color: t.ink2, marginBottom: 6 }]}>{ROW_TITLES[row]}</Text>
        {sided ? (
          <View style={{ flexDirection: "row", gap: 6 }}>
            {column({ row, side: 0 }, r.left)}
            {column({ row, side: null }, r.mid, me ?? bond)}
            {column({ row, side: 1 }, r.right, pets)}
          </View>
        ) : (
          column({ row, side: null }, [...r.left, ...r.mid, ...r.right], <>{me}{pets}</>)
        )}
      </View>
    );
  };

  return (
    <Page title={tr("{0}'s family tree", [child.name])}>
      <View ref={root}>
        <Text style={[TYPE.bodySmall, { color: t.ink3, marginBottom: 14 }]}>
          {tr("Press and hold someone, then drag them next to a person to connect them, or onto an empty spot in a row to move them there. Tap someone for the same choices. Press and hold the ♥ between two people to separate them.")}
        </Text>
        {sided ? (
          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            <Text style={[TYPE.labelLarge, { color: t.accentDeep, flex: 1, textAlign: "center" }]}>{L.sides![0]}</Text>
            <View style={{ flex: 1 }} />
            <Text style={[TYPE.labelLarge, { color: t.accentDeep, flex: 1, textAlign: "center" }]}>{L.sides![1]}</Text>
          </View>
        ) : null}
        {(["great", "grand", "parent", "same"] as const).map(rowView)}
        {L.other.length ? (
          <View>
            <Text role="heading" aria-level={2} style={[TYPE.titleSmall, { color: t.ink2, marginBottom: 6 }]}>{tr("Godparents, friends and others")}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{group(L.other)}</View>
          </View>
        ) : null}
        {family.length === 0 ? <Text style={{ color: t.ink3, textAlign: "center", padding: 24 }}>{tr("No one in {0}'s family yet. Add people in Family first.", [child.name])}</Text> : null}

        {carry && carried ? (
          <View pointerEvents="none" style={{ position: "absolute", left: carry.x - origin.current.x - 42, top: carry.y - origin.current.y - 40, width: 84, alignItems: "center", transform: [{ scale: 1.12 }], zIndex: 10 }}>
            <MemberAvatar member={carried} size={56} ring />
            <Text style={[TYPE.labelMedium, { color: t.ink, marginTop: 4 }]} numberOfLines={1}>{displayName(carried)}</Text>
          </View>
        ) : null}
      </View>

      {ask ? <ConnectSheet who={ask.who} target={ask.target} family={family} child={child} onDone={(p) => { if (p) apply(p); setAsk(null); }} /> : null}
    </Page>
  );
}

/** How someone is joined to another person (after a drop, or chosen step by step after a tap), or which row they go in. */
function ConnectSheet({ who, target: dropped, family, child, onDone }: { who: Relative; target?: Target; family: Relative[]; child: Child; onDone: (patches?: { id: string; patch: Partial<Relative> }[]) => void }) {
  const t = useTheme();
  const [target, setTarget] = useState<Target | undefined>(dropped);
  const name = displayName(who);
  const tName = target === ME ? child.name : target ? displayName(target) : "";
  const pet = kinOf(who) === "pet";
  const choices = target ? linkChoices(target, family) : [];
  const people = family.filter((r) => r.id !== who.id && linkChoices(r, family).length);
  const sides = sideChoices(family);
  return (
    <Sheet visible onClose={() => onDone()} title={target ? tr("{0} is {1}'s…", [name, tName]) : name}>
      {pet ? (
        <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>{tr("Pets always sit at the end of {0}'s row.", [child.name])}</Text>
      ) : target ? (
        <View style={{ gap: 8 }}>
          {choices.map((l: Link) => (
            <Btn key={l} label={LINK_WORDS[l]} kind="line" onPress={() => onDone(connect(who, target, l, family))} />
          ))}
          {!dropped ? <Btn label={tr("Back")} kind="soft" onPress={() => setTarget(undefined)} /> : <Btn label={tr("Cancel")} kind="soft" onPress={() => onDone()} />}
        </View>
      ) : (
        <View>
          <Text style={[TYPE.titleSmall, { color: t.ink, marginBottom: 6 }]}>{tr("Connect {0} to…", [name])}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {linkChoices(ME, family).length ? (
              <Pressable onPress={() => setTarget(ME)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingLeft: 4, paddingRight: 12, borderRadius: 20, borderWidth: 1, borderColor: t.outline }}>
                <Avatar child={child} size={28} /><Text style={[TYPE.labelLarge, { color: t.ink }]}>{child.name}</Text>
              </Pressable>
            ) : null}
            {people.map((r) => (
              <Pressable key={r.id} onPress={() => setTarget(r)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingLeft: 4, paddingRight: 12, borderRadius: 20, borderWidth: 1, borderColor: t.outline }}>
                <MemberAvatar member={r} size={28} /><Text style={[TYPE.labelLarge, { color: t.ink }]}>{displayName(r)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[TYPE.titleSmall, { color: t.ink, marginTop: 18, marginBottom: 6 }]}>{tr("Or move {0} to a row", [name])}</Text>
          <View style={{ gap: 8 }}>
            {PLACES.map(([r, side, label]) => {
              const sideName = side == null ? "" : ` · ${sides[side]?.label ?? (side === 0 ? "first side" : "second side")}`;
              return <Btn key={`${r}${side}`} label={`${label}${sideName}`} kind="soft" onPress={() => onDone(placeInRow(who, r, side, family))} />;
            })}
          </View>
        </View>
      )}
    </Sheet>
  );
}
