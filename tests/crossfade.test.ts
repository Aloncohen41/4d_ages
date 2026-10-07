/*
 * Guards the "pictures reappear before the next one" bug in the exported video. This mirrors the frame logic of
 * SlideshowEncoder.renderFrame (Kotlin): the old picture holds still underneath while the new one fades in on top.
 */
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };

const zoomAt = (local: number, drift: number) => { const p = Math.min(1, local / drift); const e = 1 - Math.pow(1 - p, 3); return 1 + 0.08 * (1 - e); };
const smooth = (x: number) => x * x * (3 - 2 * x);
interface Layer { index: number; local: number; alpha: number }

function layersAt(durations: number[], fadeMs: number, t: number): Layer[] {
  const starts: number[] = []; let acc = 0; for (const d of durations) { starts.push(acc); acc += d; }
  let i = 0; while (i < durations.length - 1 && t >= starts[i + 1]) i++;
  const local = t - starts[i];
  if (i > 0) {
    const fade = Math.min(fadeMs, 0.6 * Math.min(durations[i], durations[i - 1]));
    if (local < fade) return [{ index: i - 1, local: durations[i - 1], alpha: 1 }, { index: i, local, alpha: smooth(Math.min(1, Math.max(0, local / fade))) }];
  }
  return [{ index: i, local, alpha: 1 }];
}

const configs = [
  { name: "1× with intro", per: 2400, fade: 1300, intro: 2200, n: 8 },
  { name: "0.5× slow", per: 4800, fade: 1300, intro: 2200, n: 6 },
  { name: "2× fast", per: 1200, fade: 660, intro: 2200, n: 10 },
  { name: "4× very fast (short slides)", per: 600, fade: 330, intro: 0, n: 12 },
];
for (const c of configs) {
  const durations = [...(c.intro ? [c.intro] : []), ...Array.from({ length: c.n }, () => c.per)];
  const drift = c.per * 1.6;
  const total = durations.reduce((a, b) => a + b, 0);
  const seenGone = new Set<number>(); let prev = new Set<number>();
  let onlyNeighbours = true, outgoingFrozen = true, monotonic = true, reappeared = false;
  const lastAlpha = new Map<number, number>();

  for (let t = 0; t < total; t += 1000 / 30) {
    const ls = layersAt(durations, c.fade, t);
    const now = new Set(ls.map((l) => l.index));
    const top = Math.max(...now);
    for (const k of now) if (k < top - 1 || (k === top - 1 && ls.length < 2)) onlyNeighbours = false;
    for (const k of prev) if (!now.has(k)) seenGone.add(k);
    for (const k of now) if (seenGone.has(k)) reappeared = true;          // a picture that left must never come back
    if (ls.length === 2) {
      if (ls[0].local !== durations[ls[0].index]) outgoingFrozen = false; // the old picture does not move or reset
      const a = ls[1].alpha, la = lastAlpha.get(ls[1].index) ?? 0;
      if (a + 1e-9 < la) monotonic = false;
      lastAlpha.set(ls[1].index, a);
    }
    prev = now;
  }
  ok(`${c.name}: only the previous and current picture are ever drawn`, onlyNeighbours);
  ok(`${c.name}: a picture never comes back after it has gone`, !reappeared);
  ok(`${c.name}: the outgoing picture holds still under the fade (no zoom reset / jump)`, outgoingFrozen);
  ok(`${c.name}: the incoming picture only ever fades IN (never flickers out and back)`, monotonic);

  // continuity: the last frame before the fade equals the frame the fade starts from
  let continuous = true;
  for (let i = 1; i < durations.length; i++) {
    const start = durations.slice(0, i).reduce((a, b) => a + b, 0);
    const before = layersAt(durations, c.fade, start - 1)[0], at = layersAt(durations, c.fade, start)[0];
    if (before.index !== i - 1 || at.index !== i - 1) { continuous = false; continue; }
    if (Math.abs(zoomAt(before.local, drift) - zoomAt(at.local, drift)) > 0.002) continuous = false;
  }
  ok(`${c.name}: no jump at the moment a fade begins`, continuous);
  ok(`${c.name}: every picture is held fully visible for a while before the next fade`, durations.every((d, i) => i === 0 || Math.min(c.fade, 0.6 * Math.min(d, durations[i - 1])) <= 0.6 * d));
}
console.log(fails ? `${fails} FAILED` : "all video-transition tests passed");
