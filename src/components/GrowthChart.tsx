import React, { useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "../lib/useTheme";
import { Child, HeightEntry } from "../lib/types";
import { ageShort, formatDate } from "../lib/date";
import { DOOR_MAX_CM, DOOR_REFS, HeightUnit, WeightUnit, effectiveRef, formatHeight, fromCm, fromKg, monthsOld, placeLabels, typicalRange } from "../lib/growth";
import { Icon } from "./Icon";
import { useStore } from "../lib/store";
import { CENTILE_LINES, centileCurve } from "../lib/percentiles";

/** Growth curve: your measurements as a line, over the 3rd, 50th and 97th percentile lines for their age and sex (WHO or CDC charts). */
export function LineChart({ child, entries, unit, mode = "height", weightUnit = "kg", centiles = true }: {
  child: Child;
  entries: { date: string; cm?: number; kg?: number }[];
  unit: HeightUnit;
  mode?: "height" | "weight";
  weightUnit?: WeightUnit;
  centiles?: boolean; // the children's percentile lines (off for a pet)
}) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const H = 230, L = 40, R = 14, T = 12, B = 26;

  const source = useStore((s) => s.growthChart);
  const pts = entries.map((e) => ({ x: monthsOld(child.birth, e.date), y: (mode === "weight" ? e.kg : e.cm) as number }));
  if (!pts.length) return null;
  const maxX = Math.max(12, Math.ceil(Math.max(...pts.map((p) => p.x)) / 6) * 6);
  // the 3rd, 50th and 97th percentile lines for their age and sex, from the chosen charts (WHO or CDC)
  const lines = !centiles ? [] : CENTILE_LINES.map((c) => ({ label: c.label, pts: centileCurve(source, mode, effectiveRef(child), c.z, maxX) })).filter((c) => c.pts.length > 1);
  const all = lines.flatMap((c) => c.pts.map((p) => p[1]));
  const stepY = mode === "weight" ? (maxX > 72 ? 5 : 2) : 10;
  const minY = Math.floor(Math.min(...pts.map((p) => p.y), ...all) / stepY) * stepY;
  let maxY = Math.ceil(Math.max(...pts.map((p) => p.y), ...all) / stepY) * stepY;
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
          {/* the shaded space between the 3rd and 97th percentiles, then the three lines, labelled at their end */}
          {lines.length === 3 ? lines[0].pts.slice(0, -1).map(([x, hi], i) => {
            const lo = lines[2].pts[i]?.[1];
            const nx = lines[0].pts[i + 1][0];
            return lo == null ? null : <View key={x} style={{ position: "absolute", left: X(x), width: X(nx) - X(x) + 0.6, top: Y(hi), height: Math.max(0, Y(lo) - Y(hi)), backgroundColor: t.accent, opacity: 0.08 }} />;
          }) : null}
          {lines.map((c) => (
            <React.Fragment key={c.label}>
              {c.pts.slice(1).map((p, i) => {
                const a = c.pts[i];
                const x1 = X(a[0]), y1 = Y(a[1]), x2 = X(p[0]), y2 = Y(p[1]);
                const len = Math.hypot(x2 - x1, y2 - y1);
                return <View key={i} style={{ position: "absolute", left: (x1 + x2) / 2 - len / 2, top: (y1 + y2) / 2 - 0.5, width: len, height: c.label === "50th" ? 1.5 : 1, backgroundColor: t.ink3, opacity: c.label === "50th" ? 0.55 : 0.35, transform: [{ rotate: `${Math.atan2(y2 - y1, x2 - x1)}rad` }] }} />;
              })}
              <Text style={{ position: "absolute", left: X(c.pts[c.pts.length - 1][0]) - 30, top: Y(c.pts[c.pts.length - 1][1]) - 14, width: 30, textAlign: "right", fontSize: 9, color: t.ink3, fontWeight: "700" }}>{c.label}</Text>
            </React.Fragment>
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

/**
 * Pencil marks on a door frame. Everyday things at their real height on the left, the frame in the middle (0 to 2 metres, so a child is never
 * drawn at the top), and the child's marks on the right: name on the newest, then height and age.
 */
export function DoorFrame({ child, entries, unit }: { child: Child; entries: HeightEntry[]; unit: HeightUnit }) {
  const t = useTheme();
  const H = 460; // px for the full 2 m
  const PAD = 12;
  const Y = (cm: number) => PAD + H - (Math.min(cm, DOOR_MAX_CM) / DOOR_MAX_CM) * H;
  const ticks: number[] = [];
  for (let c = 0; c <= DOOR_MAX_CM; c += 10) ticks.push(c);
  const marks = [...entries].sort((a, b) => b.cm - a.cm || b.date.localeCompare(a.date));
  const newest = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0];
  const labelTops = placeLabels(marks.map((e) => Y(e.cm) - 8), 17, PAD, PAD + H - 4);
  const frameW = 64;

  return (
    <View style={{ height: H + PAD * 2, backgroundColor: t.bg2, borderRadius: 18, borderWidth: 1, borderColor: t.line, overflow: "hidden", flexDirection: "row" }}>
      {/* reference objects, at their real height */}
      <View style={{ flex: 1 }}>
        {DOOR_REFS.map((o) => (
          <View key={o.name} style={{ position: "absolute", right: 6, top: Y(o.cm) - 11, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: t.ink3, fontSize: 10.5, fontWeight: "700" }} numberOfLines={1}>{o.name}</Text>
            <Icon name={o.icon} size={20} color={t.ink2} />
          </View>
        ))}
      </View>

      {/* the frame, with a scale every 10 cm (numbers every 50) */}
      <View style={{ width: frameW }}>
        <View style={{ position: "absolute", left: 0, top: PAD - 4, bottom: PAD, width: 6, borderRadius: 3, backgroundColor: t.outline, opacity: 0.55 }} />
        <View style={{ position: "absolute", right: 0, top: PAD - 4, bottom: PAD, width: 6, borderRadius: 3, backgroundColor: t.outline, opacity: 0.55 }} />
        {ticks.map((c) => (
          <View key={c} style={{ position: "absolute", left: 6, width: c % 50 === 0 ? 16 : 8, top: Y(c) - 0.75, height: 1.5, backgroundColor: t.ink3, opacity: 0.55 }}>
            {c % 50 === 0 ? <Text style={{ position: "absolute", left: 18, top: -7, width: 34, fontSize: 10, color: t.ink3, fontWeight: "700" }}>{Math.round(fromCm(c, unit))}</Text> : null}
          </View>
        ))}
        {marks.map((e) => (
          <View key={e.id} style={{ position: "absolute", left: 0, right: 0, top: Y(e.cm) - 1.5, height: 3, borderRadius: 2, backgroundColor: e.id === newest?.id ? t.accentDeep : t.accent }} />
        ))}
      </View>

      {/* the child's marks */}
      <View style={{ flex: 1 }}>
        {marks.map((e, i) => (
          <Text key={e.id} numberOfLines={1} style={{ position: "absolute", left: 8, right: 4, top: labelTops[i], color: e.id === newest?.id ? t.ink : t.ink2, fontSize: 11, fontWeight: e.id === newest?.id ? "800" : "700" }}>
            {e.id === newest?.id ? `${child.name} · ` : ""}{formatHeight(e.cm, unit)} · {ageShort(child.birth, e.date).replace(" old", "")}
          </Text>
        ))}
      </View>
    </View>
  );
}

export const measurementLabel = (e: HeightEntry, unit: HeightUnit) => `${formatHeight(e.cm, unit)} · ${formatDate(e.date)}`;
