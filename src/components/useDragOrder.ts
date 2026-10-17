import { useLayoutEffect, useRef, useState } from "react";
import { Animated, PanResponder, View } from "react-native";

/*
 * Reordering things in a row by dragging them, like apps on a phone's home screen: press and hold one and it lifts and follows the finger
 * (or the mouse); the others slide aside to show where it will land, and when it's let go it glides into that gap. While one is held,
 * `held` is set, so the others can wiggle. A short press is still a press (`onTap`), and before the hold the row can still scroll.
 */
type Slot = { id: string; x: number; w: number };

export function useDragOrder(ids: string[], onMove: (id: string, to: number) => void, onTap: (id: string) => void) {
  const [held, setHeld] = useState<{ id: string } | null>(null);
  const views = useRef(new Map<string, View | null>());
  const latest = useRef({ ids, onMove, onTap });
  latest.current = { ids, onMove, onTap };
  const handlers = useRef(new Map<string, ReturnType<typeof PanResponder.create>>());
  // where each one is pushed to while another is dragged (and the dragged one itself, following the finger)
  const pos = useRef(new Map<string, Animated.ValueXY>());
  const lift = useRef(new Animated.Value(1)).current;
  const at = (id: string) => {
    let v = pos.current.get(id);
    if (!v) { v = new Animated.ValueXY({ x: 0, y: 0 }); pos.current.set(id, v); }
    return v;
  };
  // once the new order is drawn, everyone is back in their own place (no jump: this runs before the screen shows it)
  const order = ids.join();
  useLayoutEffect(() => { for (const v of pos.current.values()) v.setValue({ x: 0, y: 0 }); }, [order]);

  const measure = () =>
    Promise.all(latest.current.ids.map((id) => new Promise<Slot | null>((res) => {
      const v = views.current.get(id);
      if (!v) return res(null);
      v.measureInWindow((x, _y, w) => res({ id, x, w }));
    }))).then((list) => list.filter((s): s is Slot => !!s));

  /** Where everyone would sit with `id` moved to place `to`: how far each one moves from where it is now. */
  const shifts = (slots: Slot[], id: string, to: number) => {
    const out = new Map<string, number>();
    if (!slots.length) return out;
    const rtl = slots.length > 1 && slots[1].x < slots[0].x;
    const gap = slots.length > 1 ? (rtl ? slots[0].x - (slots[1].x + slots[1].w) : slots[1].x - (slots[0].x + slots[0].w)) : 0;
    const next = slots.filter((s) => s.id !== id);
    const me = slots.find((s) => s.id === id);
    if (me) next.splice(to, 0, me);
    let edge = rtl ? slots[0].x + slots[0].w : slots[0].x;
    for (const s of next) {
      const x = rtl ? edge - s.w : edge;
      edge = rtl ? edge - s.w - gap : edge + s.w + gap;
      out.set(s.id, x - s.x);
    }
    return out;
  };
  const glide = (id: string, x: number, y = 0) => Animated.spring(at(id), { toValue: { x, y }, useNativeDriver: false, speed: 22, bounciness: 4 });

  const handler = (id: string) => {
    let h = handlers.current.get(id);
    if (h) return h;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lifted = false;
    let moved = false;
    let slots: Slot[] = [];
    let target = -1;
    const placeFor = (dx: number) => {
      const me = slots.find((s) => s.id === id);
      if (!me) return -1;
      const cx = me.x + me.w / 2 + dx;
      let best = -1, d = Infinity;
      slots.forEach((s, i) => { const dist = Math.abs(s.x + s.w / 2 - cx); if (dist < d) { d = dist; best = i; } });
      return best;
    };
    h = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => !lifted, // until it's picked up, the row can still scroll
      onPanResponderGrant: () => {
        lifted = false; moved = false; slots = []; target = -1;
        timer = setTimeout(async () => {
          lifted = true;
          setHeld({ id });
          Animated.spring(lift, { toValue: 1.08, useNativeDriver: false, speed: 30 }).start();
          slots = await measure();
          target = latest.current.ids.indexOf(id);
        }, 350);
      },
      onPanResponderMove: (_e, g) => {
        if (!lifted) { if (Math.abs(g.dx) + Math.abs(g.dy) > 10) { moved = true; if (timer) clearTimeout(timer); } return; }
        at(id).setValue({ x: g.dx, y: g.dy });
        const to = placeFor(g.dx);
        if (to < 0 || to === target) return;
        // the others make room: each slides to where it would be with this one put here
        target = to;
        const s = shifts(slots, id, to);
        for (const other of latest.current.ids) if (other !== id) glide(other, s.get(other) ?? 0).start();
      },
      onPanResponderRelease: () => {
        if (timer) clearTimeout(timer);
        if (!lifted) { if (!moved) latest.current.onTap(id); return; }
        lifted = false;
        const from = latest.current.ids.indexOf(id);
        const to = target < 0 ? from : target;
        // it glides into its gap, then the new order is saved (and everyone's place is redrawn without moving)
        glide(id, shifts(slots, id, to).get(id) ?? 0).start(() => {
          Animated.timing(lift, { toValue: 1, duration: 120, useNativeDriver: false }).start();
          setHeld(null);
          if (to !== from) latest.current.onMove(id, to);
          else for (const v of pos.current.values()) v.setValue({ x: 0, y: 0 });
        });
      },
      onPanResponderTerminate: () => {
        if (timer) clearTimeout(timer);
        lifted = false;
        setHeld(null);
        lift.setValue(1);
        for (const other of latest.current.ids) glide(other, 0).start();
      },
    });
    handlers.current.set(id, h);
    return h;
  };

  /** The moving part of each one's style: where it's been pushed to (and, for the one held, lifted a little). */
  const style = (id: string) => {
    const v = at(id);
    const mine = held?.id === id;
    return { transform: [{ translateX: v.x }, { translateY: v.y }, { scale: mine ? lift : 1 }], zIndex: mine ? 10 : 0 };
  };

  return { held, handler, style, register: (id: string) => (v: View | null) => { views.current.set(id, v); } };
}
