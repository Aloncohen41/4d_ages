import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, ScrollView, Text, View } from "react-native";
import { Page } from "../src/components/Page";
import { Avatar, Btn, MemberAvatar, Sheet } from "../src/components/ui";
import { Icon } from "../src/components/Icon";
import { familyOf } from "../src/lib/family";
import { descentGroups, LINK_WORDS, Link, ME, Row, connect, isCouple, kinOf, linkChoices, placeInRow, separate, sideChoices, treeLayout } from "../src/lib/kinship";
import { useShownChild, useStore } from "../src/lib/store";
import { useTheme } from "../src/lib/useTheme";
import { displayName, relationLine } from "../src/lib/tags";
import { withAlpha } from "../src/lib/m3";
import { Child, Relative } from "../src/lib/types";
import { TYPE } from "../src/theme";

import { isRTL, tr } from "../src/lib/i18n";
/*
 * The family tree, built by hand. Press and hold someone and drag them:
 *  - next to another person, to join them ("Ruth is Dana's… mother or father / partner / brother or sister / son or daughter"), which sets
 *    who they are to the child, their side and who they're with;
 *  - onto an empty part of a row, to put them in that generation, on that side.
 * Friends of the family (and godparents, carers) have their own place below, joined to no one: drop someone there to put them in it.
 * Two parents (or two grandparents on one side) are taken to be together; a long press on the ♥ between a couple separates them. Pets
 * always sit at the far end of the child's row. Tapping someone offers the same choices without dragging (and works with a keyboard).
 */
type Zone = { row: Row; side: 0 | 1 | null };
type Target = Relative | typeof ME;
const zoneKey = (z: Zone) => `${z.row}:${z.side ?? "mid"}`;

const ROW_TITLES: Record<Exclude<Row, "other">, string> = {
  great: "Great-grandparents",
  grand: "Grandparents",
  parent: "Parents, aunts and uncles",
  same: "Brothers, sisters and cousins",
};

/** The rows someone can be moved to from the tap menu: a generation, and the side (null: not on a side). */
const PLACES: [Row, 0 | 1 | null, string][] = [
  ["great", 0, "Great-grandparent"], ["great", 1, "Great-grandparent"],
  ["grand", 0, "Grandparent"], ["grand", 1, "Grandparent"],
  ["parent", null, "Parent"], ["parent", 0, "Aunt or uncle"], ["parent", 1, "Aunt or uncle"],
  ["same", null, "Brother or sister"], ["same", 0, "Cousin"], ["same", 1, "Cousin"],
  ["other", null, "Friend of the family, not connected"],
];

export default function TreePage() {
  const t = useTheme();
  const child = useShownChild();
  const relatives = useStore((s) => s.relatives);
  const updateRelative = useStore((s) => s.updateRelative);
  const family = useMemo(() => (child ? familyOf(relatives, child.id).filter((r) => r.childRef !== child.id) : []), [relatives, child]);
  const L = useMemo(() => treeLayout(family), [family]);

  // the room there is: on a phone everyone is a little smaller, and a tree wider than the screen scrolls sideways (it never wraps)
  const [avail, setAvail] = useState(0);
  const narrow = avail > 0 && avail < 560;
  const NW = narrow ? 72 : 84; // each person's width
  const AV = narrow ? 44 : 52; // their picture

  // where everything is on screen (measured when someone is dropped), and the person being carried
  const outer = useRef<View>(null);
  const root = useRef<View>(null);
  const scroller = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current; // how far a wide tree is scrolled sideways
  const nodes = useRef(new Map<string, View | null>());
  const zones = useRef(new Map<string, View | null>());
  const [carry, setCarry] = useState<{ id: string; x: number; y: number } | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const [ask, setAsk] = useState<{ who: Relative; target?: Target } | null>(null);
  const latest = useRef({ family, child });
  latest.current = { family, child };

  // the lines from parents down to their children, worked out from where everyone sits once the tree is drawn (and again whenever it moves)
  const [lines, setLines] = useState<{ x: number; y: number; w: number; h: number }[]>([]);
  const layoutTick = useRef(0);
  const drawLines = () => {
    const tick = ++layoutTick.current;
    const half = AV / 2;
    setTimeout(async () => {
      const base = await measure(root.current);
      if (!base || tick !== layoutTick.current) return;
      const at = new Map<string, { cx: number; top: number; mid: number; bottom: number }>();
      for (const [id, v] of nodes.current) {
        const b = await measure(v);
        if (b && b.w) at.set(id, { cx: b.x - base.x + b.w / 2, top: b.y - base.y, mid: b.y - base.y + half, bottom: b.y - base.y + b.h });
      }
      if (tick !== layoutTick.current) return;
      const T = 2; // the lines' thickness
      const out: { x: number; y: number; w: number; h: number }[] = [];
      for (const g of descentGroups(latest.current.family)) {
        const ps = g.parents.map((id) => at.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
        const cs = g.children.map((id) => at.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
        if (!ps.length || !cs.length) continue;
        // from the middle of a couple (on the line between them), or below a single parent
        const x0 = ps.reduce((n, p) => n + p.cx, 0) / ps.length;
        const y0 = ps.length > 1 ? Math.max(...ps.map((p) => p.mid)) : ps[0].bottom + 2;
        // a couple joined by a line between them (however far apart their places are), with the ♥ on it
        if (ps.length > 1) out.push({ x: Math.min(...ps.map((p) => p.cx)), y: y0 - T / 2, w: Math.abs(ps[1].cx - ps[0].cx), h: T });
        const top = Math.min(...cs.map((c) => c.top));
        if (top <= y0) continue;
        // an upside-down T: down from the parents, across over all their children, and down to each
        const bar = Math.max(y0 + 6, top - 14);
        const xs = [x0, ...cs.map((c) => c.cx)];
        out.push({ x: x0 - T / 2, y: y0, w: T, h: bar - y0 });
        out.push({ x: Math.min(...xs), y: bar - T / 2, w: Math.max(...xs) - Math.min(...xs), h: T });
        for (const c of cs) out.push({ x: c.cx - T / 2, y: bar, w: T, h: c.top - bar });
      }
      setLines(out);
    }, 60);
  };
  useEffect(() => { drawLines(); }, [family, NW]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = (patches: { id: string; patch: Partial<Relative> }[]) => patches.forEach((p) => updateRelative(p.id, p.patch));

  const measure = (v: View | null | undefined) =>
    new Promise<{ x: number; y: number; w: number; h: number } | null>((res) => (v ? v.measureInWindow((x, y, w, h) => res({ x, y, w, h })) : res(null)));

  /** Where the carried person was let go: next to someone (ask how they're joined), on an empty part of a row (move them there), or in Friends. */
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
        apply(placeInRow(who, row as Row, side === "mid" ? null : (Number(side) as 0 | 1), fam));
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
          const b = await measure(outer.current);
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

  // the two parents, and whether they're together (the ♥ between them, in the middle of their row)
  const ps = family.filter((x) => kinOf(x) === "parent");
  const sided = !!L.sides;
  const bonded = sided && ps.length === 2 && isCouple(ps[0], ps[1], family);

  // how wide each part of the tree is: each side as wide as its widest row, so a parent's family always lines up above them
  const GAP = 6, PAD = 6, HEART = 26, BOND = 34;
  const span = (list: Relative[], extra = 0, extraItems = 0) => {
    let n = 0, couples = 0, items = extraItems;
    for (let k = 0; k < list.length; k++) { n++; items++; if (list[k + 1] && isCouple(list[k], list[k + 1], family)) { n++; couples++; k++; } }
    return n * NW + couples * HEART + extra + Math.max(0, items - 1) * GAP + 2 * PAD + 3;
  };
  const ROWS = ["great", "grand", "parent", "same"] as const;
  // the parents always meet in the middle: an aunt or uncle whose side isn't known yet waits at the far end of the row, never between them
  const midList = (row: (typeof ROWS)[number]) => (row === "parent" ? [] : L[row].mid);
  const midSpan = (row: (typeof ROWS)[number]) => (row === "same" ? span(L.same.mid, NW, 1) : row === "parent" ? (bonded ? span([], BOND, 1) : span([])) : span(L[row].mid));
  const rightList = (row: (typeof ROWS)[number]) => (row === "same" ? [...L.same.right, ...L.pets] : row === "parent" ? [...L.parent.right, ...L.parent.mid] : L[row].right);
  let cols = { left: 0, mid: 0, right: 0 };
  let canvas: number;
  if (sided) {
    cols = {
      left: Math.max(NW + 2 * PAD, ...ROWS.map((r) => span(L[r].left))),
      mid: Math.max(NW + 2 * PAD, ...ROWS.map(midSpan)),
      right: Math.max(NW + 2 * PAD, ...ROWS.map((r) => span(rightList(r)))),
    };
    const total = cols.left + cols.mid + cols.right + 2 * GAP;
    const spare = avail > total ? (avail - total) / 3 : 0;
    cols = { left: cols.left + spare, mid: cols.mid + spare, right: cols.right + spare };
    canvas = Math.max(total, avail);
  } else {
    canvas = Math.max(avail, ...ROWS.map((r) => span([...L[r].left, ...L[r].mid, ...L[r].right, ...(r === "same" ? L.pets : [])], r === "same" ? NW : 0, r === "same" ? 1 : 0)));
  }
  // a tree wider than the screen starts in the middle (where the child is)
  const centred = useRef(false);
  useEffect(() => {
    if (centred.current || !avail || canvas <= avail + 1 || isRTL()) return;
    centred.current = true;
    setTimeout(() => scroller.current?.scrollTo({ x: (canvas - avail) / 2, animated: false }), 0);
  }, [avail, canvas]);

  if (!child) return null;
  const carried = carry ? family.find((r) => r.id === carry.id) : undefined;

  const node = (r: Relative) => (
    <View key={r.id} ref={(v) => { nodes.current.set(r.id, v); }} {...handler(r.id).panHandlers} accessible accessibilityRole="button" accessibilityLabel={tr("{0}, {1}. Press to connect or move", [displayName(r), relationLine(r)])}
      style={{ alignItems: "center", width: NW, opacity: carry?.id === r.id ? 0.3 : 1, cursor: "grab" } as object}>
      <MemberAvatar member={r} size={AV} />
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
              style={{ marginTop: AV / 2 - 10, width: HEART, height: 22, alignItems: "center", justifyContent: "center" }}>
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
  // one part of a row: on one line, never wrapping; each side's people sit towards the middle (the parents innermost, their brothers and
  // sisters further out), so the lines from the grandparents above make an upside-down T over all of them
  const column = (z: Zone, list: Relative[], width: number, extra?: React.ReactNode) => (
    <View key={zoneKey(z)} ref={(v) => { zones.current.set(zoneKey(z), v); }} style={{ width, minHeight: list.length || extra ? AV + 44 : 52, flexDirection: "row", flexWrap: "nowrap", justifyContent: z.side === 0 ? "flex-end" : z.side === 1 ? "flex-start" : "center", alignItems: "flex-start", gap: GAP, padding: PAD, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: carry ? withAlpha(t.accent, 0.5) : "transparent", backgroundColor: carry ? withAlpha(t.accent, 0.04) : "transparent" }}>
      {group(list)}
      {extra}
    </View>
  );
  const rowView = (row: (typeof ROWS)[number]) => {
    const r = L[row];
    const me = row === "same" ? (
      <View key="me" ref={(v) => { nodes.current.set(ME, v); }} style={{ alignItems: "center", width: NW }} accessible accessibilityLabel={tr("{0}, that's who the tree is for", [child.name])}>
        <Avatar child={child as Child} size={AV + 8} ring />
        <Text style={[TYPE.labelMedium, { color: t.ink, marginTop: 4, fontWeight: "700" }]} numberOfLines={1}>{child.name}</Text>
      </View>
    ) : null;
    const pets = row === "same" ? group(L.pets) : null;
    // the two parents sit at the inner edge of their own sides: what joins them is shown in the middle, between them
    const bond = row === "parent" && bonded ? (
      <Pressable key="bond" onLongPress={() => apply(separate(ps[0], ps[1]))} delayLongPress={450} accessibilityRole="button" accessibilityLabel={tr("{0} and {1} are together. Press and hold to separate them", [displayName(ps[0]), displayName(ps[1])])}
        style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, marginTop: AV / 2 - 16 }}>
        <Text style={{ color: t.accent, fontSize: 16, backgroundColor: t.bg, paddingHorizontal: 4 }}>♥</Text>
      </Pressable>
    ) : null;
    return (
      <View key={row} style={{ marginBottom: 18 }}>
        {/* the row's name stays at the edge of the screen while a wide tree scrolls sideways */}
        <Animated.Text role="heading" aria-level={2} style={[TYPE.titleSmall, { color: t.ink2, marginBottom: 6, alignSelf: "flex-start", backgroundColor: t.bg, paddingEnd: 8, transform: [{ translateX: scrollX }] }]}>{ROW_TITLES[row]}</Animated.Text>
        {sided ? (
          <View style={{ flexDirection: "row", gap: GAP }}>
            {column({ row, side: 0 }, r.left, cols.left)}
            {column({ row, side: null }, midList(row), cols.mid, me ?? bond)}
            {column({ row, side: 1 }, row === "parent" ? rightList(row) : r.right, cols.right, pets)}
          </View>
        ) : (
          column({ row, side: null }, [...r.left, ...r.mid, ...r.right], canvas, <>{me}{pets}</>)
        )}
      </View>
    );
  };

  return (
    <Page title={tr("{0}'s family tree", [child.name])}>
      <Text style={[TYPE.bodySmall, { color: t.ink3, marginBottom: 14 }]}>
        {tr("Press and hold someone, then drag them next to a person to connect them, or onto an empty spot in a row to move them there. Tap someone for the same choices. Press and hold the ♥ between two people to separate them.")}
      </Text>
      <View ref={outer} onLayout={(e) => setAvail(Math.round(e.nativeEvent.layout.width))}>
        <ScrollView ref={scroller} horizontal scrollEnabled={!carry} scrollEventThrottle={16} onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })} showsHorizontalScrollIndicator={canvas > avail + 1} contentContainerStyle={{ width: canvas }}>
          <View ref={root} onLayout={drawLines} style={{ width: canvas }}>
            {/* the lines joining parents and children, behind everyone (hidden while someone is being carried) */}
            {!carry ? (
              <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
                {lines.map((l, i) => <View key={i} style={{ position: "absolute", left: l.x, top: l.y, width: Math.max(2, l.w), height: Math.max(2, l.h), backgroundColor: withAlpha(t.ink, 0.3), borderRadius: 1 }} />)}
              </View>
            ) : null}
            {/* everyone above the lines */}
            <View style={{ zIndex: 1 }}>
              {sided ? (
                <View style={{ flexDirection: "row", gap: GAP, marginBottom: 8 }}>
                  <Text style={[TYPE.labelLarge, { color: t.accentDeep, width: cols.left, textAlign: "center" }]}>{L.sides![0]}</Text>
                  <View style={{ width: cols.mid }} />
                  <Text style={[TYPE.labelLarge, { color: t.accentDeep, width: cols.right, textAlign: "center" }]}>{L.sides![1]}</Text>
                </View>
              ) : null}
              {ROWS.map(rowView)}
            </View>
          </View>
        </ScrollView>

        {/* friends of the family (and godparents, carers): in the tree, but joined to no one */}
        {family.length ? (
          <View ref={(v) => { zones.current.set(zoneKey({ row: "other", side: null }), v); }} style={{ marginTop: 4, padding: 10, borderRadius: 18, borderWidth: 1.5, borderStyle: "dashed", borderColor: carry ? withAlpha(t.accent, 0.5) : t.line, backgroundColor: carry ? withAlpha(t.accent, 0.04) : "transparent" }}>
            <Text role="heading" aria-level={2} style={[TYPE.titleSmall, { color: t.ink2 }]}>{tr("Friends of the family")}</Text>
            <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 2, marginBottom: L.other.length ? 10 : 0 }]}>
              {L.other.length ? tr("In the tree without a line to anyone: friends, godparents and carers.") : tr("Drag someone here to keep them in the tree without connecting them to anyone.")}
            </Text>
            {L.other.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>{group(L.other)}</View> : null}
          </View>
        ) : null}
        {family.length === 0 ? <Text style={{ color: t.ink3, textAlign: "center", padding: 24 }}>{tr("No one in {0}'s family yet. Add people in Family first.", [child.name])}</Text> : null}

        {carry && carried ? (
          <View pointerEvents="none" style={{ position: "absolute", left: carry.x - origin.current.x - NW / 2, top: carry.y - origin.current.y - 40, width: NW, alignItems: "center", transform: [{ scale: 1.12 }], zIndex: 10 }}>
            <MemberAvatar member={carried} size={AV + 4} ring />
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
            <Btn key={l} label={tr(LINK_WORDS[l])} kind="line" onPress={() => onDone(connect(who, target, l, family))} />
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
              return <Btn key={`${r}${side}`} label={`${tr(label)}${sideName}`} kind="soft" onPress={() => onDone(placeInRow(who, r, side, family))} />;
            })}
          </View>
        </View>
      )}
    </Sheet>
  );
}
