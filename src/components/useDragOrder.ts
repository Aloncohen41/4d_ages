import { useRef, useState } from "react";
import { PanResponder, View } from "react-native";

/*
 * Reordering things by dragging them, like apps on a phone's home screen: press and hold one and it lifts and follows the finger (or the
 * mouse); let go and it drops into the place nearest to where it was let go. While one is held, `held` is set, so the others can wiggle.
 * A short press is still a press (`onTap`), and before the hold the page can still scroll.
 */
export function useDragOrder(ids: string[], onMove: (id: string, to: number) => void, onTap: (id: string) => void) {
  const [held, setHeld] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const views = useRef(new Map<string, View | null>());
  const latest = useRef({ ids, onMove, onTap });
  latest.current = { ids, onMove, onTap };
  const handlers = useRef(new Map<string, ReturnType<typeof PanResponder.create>>());

  const centres = () =>
    Promise.all(latest.current.ids.map((id) => new Promise<{ id: string; x: number; y: number } | null>((res) => {
      const v = views.current.get(id);
      if (!v) return res(null);
      v.measureInWindow((x, y, w, h) => res({ id, x: x + w / 2, y: y + h / 2 }));
    })));

  const handler = (id: string) => {
    let h = handlers.current.get(id);
    if (h) return h;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lifted = false;
    let moved = false;
    let start: { x: number; y: number } | null = null;
    h = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => !lifted, // until it's picked up, the row can still scroll
      onPanResponderGrant: () => {
        lifted = false; moved = false; start = null;
        timer = setTimeout(async () => {
          lifted = true;
          setHeld({ id, dx: 0, dy: 0 });
          start = (await centres()).find((c) => c?.id === id) ?? null;
        }, 350);
      },
      onPanResponderMove: (_e, g) => {
        if (!lifted) { if (Math.abs(g.dx) + Math.abs(g.dy) > 10) { moved = true; if (timer) clearTimeout(timer); } return; }
        setHeld({ id, dx: g.dx, dy: g.dy });
      },
      onPanResponderRelease: async (_e, g) => {
        if (timer) clearTimeout(timer);
        if (!lifted) { if (!moved) latest.current.onTap(id); return; }
        lifted = false;
        const all = (await centres()).filter((c): c is { id: string; x: number; y: number } => !!c);
        setHeld(null);
        if (!start) return;
        const x = start.x + g.dx, y = start.y + g.dy;
        // the place it was let go: the profile whose middle is nearest
        let best = -1, d = Infinity;
        all.forEach((c, i) => { const dist = Math.hypot(c.x - x, (c.y - y) * 2); if (dist < d) { d = dist; best = i; } });
        const to = latest.current.ids.indexOf(all[best]?.id ?? id);
        if (to >= 0 && to !== latest.current.ids.indexOf(id)) latest.current.onMove(id, to);
      },
      onPanResponderTerminate: () => { if (timer) clearTimeout(timer); lifted = false; setHeld(null); },
    });
    handlers.current.set(id, h);
    return h;
  };

  return { held, handler, register: (id: string) => (v: View | null) => { views.current.set(id, v); } };
}
