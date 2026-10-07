import React, { useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "../lib/useTheme";
import { Child, HeightEntry } from "../lib/types";
import { ageShort, formatDate } from "../lib/date";
import { HeightUnit, WeightUnit, formatHeight, frameRefs, fromCm, fromKg, monthsOld, typicalRange } from "../lib/growth";

/** Growth curve: your measurements as a line, with the approximate typical range shaded behind. */
export function LineChart({ child, entries, unit, mode = "height", weightUnit = "kg" }: {
  child: Child;
  entries: { date: string; cm?: number; kg?: number }[];
  unit: HeightUnit;
  mode?: "height" | "weight";
  weightUnit?: WeightUnit;
}) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const H = 230, L = 40, R = 14, T = 12, B = 26;

  const pts = entries.map((e) => ({ x: monthsOld(child.birth, e.date), y: (mode === "weight" ? e.kg : e.cm) as number }));
  if (!pts.length) return null;
  const maxX = Math.max(12, Math.ceil(Math.max(...pts.map((p) => p.x)) / 6) * 6);
  const band: { x: number; lo: number; hi: number }[] = [];
  for (let m = 0; m <= Math.min(maxX, 60); m++) {
    const r = mode === "height" ? typicalRange(child.growthRef, m) : null;
    if (r) band.push({ x: m, lo: r[0], hi: r[1] });
  }
  const stepY = mode === "weight" ? 2 : 10;
  const minY = Math.floor(Math.min(...pts.map((p) => p.y), ...band.map((b) => b.lo)) / stepY) * stepY;
  let maxY = Math.ceil(Math.max(...pts.map((p) => p.y), ...band.map((b) => b.hi)) / stepY) * stepY;
  if (maxY === minY) maxY += stepY;
  const pw = Math.max(1, w - L - R);
  const ph = H - T - B;
  const X = (m: number) => L + (m / maxX) * pw;
  const Y = (cm: number) => T + (1 - (cm - minY) / (maxY - minY || 1)) * ph;

  const grid: number[] = [];
  for (let v = minY; v <= maxY; v += stepY) grid.push(v);
  const step = maxX <= 24 ? 3 : maxX <= 36 ? 6 : 12;
  const ticks: number[] = [];
  for (let m = 0; m <= maxX; m += step) ticks.push(m);
  const tickLabel = (m: number) => (m >= 24 ? `${m / 12}y` : `${m}m`);

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: H, backgroundColor: t.card, borderRadius: 18, borderWidth: 1, borderColor: t.line }}>
      {w > 0 ? (
        <>
          {grid.map((v) => (
            <View key={v} style={{ position: "absolute", left: L, right: R, top: Y(v), height: 1, backgroundColor: t.line }}>
              <Text style={{ position: "absolute", left: -36, top: -8, width: 32, textAlign: "right", fontSize: 10, color: t.ink4, fontWeight: "700" }}>{Math.round(mode === "weight" ? fromKg(v, weightUnit) : fromCm(v, unit))}</Text>
            </View>
          ))}
          {band.slice(0, -1).map((b, i) => (
            <View key={b.x} style={{ position: "absolute", left: X(b.x), width: X(band[i + 1].x) - X(b.x) + 0.6, top: Y(b.hi), height: Math.max(0, Y(b.lo) - Y(b.hi)), backgroundColor: t.accent, opacity: 0.13 }} />
          ))}
          {ticks.map((m) => (
            <Text key={m} style={{ position: "absolute", left: X(m) - 14, width: 28, textAlign: "center", top: H - B + 6, fontSize: 10, color: t.ink4, fontWeight: "700" }}>{tickLabel(m)}</Text>
          ))}
          {pts.slice(1).map((p, i) => {
            const a = pts[i];
            const x1 = X(a.x), y1 = Y(a.y), x2 = X(p.x), y2 = Y(p.y);
            const len = Math.hypot(x2 - x1, y2 - y1);
            return (
              <View key={i} style={{ position: "absolute", left: (x1 + x2) / 2 - len / 2, top: (y1 + y2) / 2 - 1.5, width: len, height: 3, borderRadius: 2, backgroundColor: t.accent, transform: [{ rotate: `${Math.atan2(y2 - y1, x2 - x1)}rad` }] }} />
            );
          })}
          {pts.map((p, i) => (
            <View key={i} style={{ position: "absolute", left: X(p.x) - 6, top: Y(p.y) - 6, width: 12, height: 12, borderRadius: 6, backgroundColor: t.card, borderWidth: 3, borderColor: t.accentDeep }} />
          ))}
        </>
      ) : null}
    </View>
  );
}

/** Pencil marks on a door frame: each measurement is a line at its height, with familiar objects for scale. */
export function DoorFrame({ child, entries, unit }: { child: Child; entries: HeightEntry[]; unit: HeightUnit }) {
  const t = useTheme();
  const H = 380;
  const maxCm = Math.max(70, ...entries.map((e) => e.cm)) * 1.1;
  const Y = (cm: number) => H - (cm / maxCm) * H;
  const ticks: number[] = [];
  for (let c = 0; c <= maxCm; c += 10) ticks.push(c);
  const objs = frameRefs(maxCm, H, 30); // thinned out so labels never overlap
  const marks = [...entries].sort((a, b) => b.cm - a.cm);
  let lastLabelTop = -100;

  return (
    <View style={{ height: H + 20, backgroundColor: t.bg2, borderRadius: 18, borderWidth: 1, borderColor: t.line, overflow: "hidden", paddingTop: 10 }}>
      <View style={{ height: H }}>
        <View style={{ position: "absolute", left: 46, top: 0, bottom: 0, width: 3, backgroundColor: t.ink3, opacity: 0.4, borderRadius: 2 }} />
        {ticks.map((c) => (
          <View key={c} style={{ position: "absolute", left: c % 20 === 0 ? 34 : 40, width: c % 20 === 0 ? 14 : 8, top: Y(c), height: 1.5, backgroundColor: t.ink3, opacity: 0.6 }}>
            {c % 20 === 0 ? <Text style={{ position: "absolute", left: -30, top: -7, width: 28, textAlign: "right", fontSize: 10, color: t.ink3, fontWeight: "700" }}>{Math.round(fromCm(c, unit))}</Text> : null}
          </View>
        ))}
        {objs.map((o) => (
          <View key={o.name} style={{ position: "absolute", right: 10, top: Y(o.cm) - 14, flexDirection: "row", alignItems: "center", gap: 6, opacity: 0.85 }}>
            <Text style={{ color: t.ink4, fontSize: 10, fontWeight: "700" }}>{o.name}</Text>
            <Text style={{ fontSize: 24 }}>{o.emoji}</Text>
          </View>
        ))}
        {marks.map((e, idx) => {
          const y = Y(e.cm);
          const labelTop = y - lastLabelTop < 18 && y - lastLabelTop >= 0 ? y + 2 : y - 17;
          if (labelTop === y - 17) lastLabelTop = y;
          return (
            <View key={e.id} style={{ position: "absolute", left: 46, top: y - 1.5, width: "46%" }}>
              <View style={{ height: 3, backgroundColor: idx === 0 ? t.accentDeep : t.accent, borderRadius: 2 }} />
              <Text style={{ position: "absolute", left: 6, top: labelTop - y + 1.5, color: t.ink, fontSize: 11, fontWeight: "700" }}>
                {idx === 0 ? `${child.emoji} ` : ""}{formatHeight(e.cm, unit)} · {ageShort(child.birth, e.date).replace(" old", "")}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export const measurementLabel = (e: HeightEntry, unit: HeightUnit) => `${formatHeight(e.cm, unit)} · ${formatDate(e.date)}`;
