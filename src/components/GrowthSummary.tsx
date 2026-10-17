import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Child, Memory } from "../lib/types";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { TYPE } from "../theme";
import { headSeries, heightSeries, weightSeries } from "../lib/selectors";
import { effectiveRef, formatHeight, formatWeight } from "../lib/growth";
import { CHART_SOURCES, IN_STEP_TEXT, Measure, Percentile, ageInMonths, atAge, inStep, percentileFor, percentileLabel } from "../lib/percentiles";
import { Icon } from "./Icon";

import { tr } from "../lib/i18n";
import { formatDate } from "../lib/date";
/**
 * The height (left), weight (right) and head circumference, each with its percentile for their age and sex on the chosen charts, and
 * whether height and weight are growing in step. A measurement past the ages a chart covers shows without a percentile.
 * Above them, the date they're from: the latest at first, with ◀ to step back through every earlier day something was measured (and ▶,
 * greyed out at the latest, to come forward again). On each day, every measure shows as it was then: measured that day, or the last
 * time before it (its own date says which).
 */
export function GrowthSummary({ child, memories }: { child: Child; memories: Memory[] }) {
  const t = useTheme();
  const source = useStore((s) => s.growthChart);
  const hUnit = useStore((s) => s.heightUnit);
  const wUnit = useStore((s) => s.weightUnit);
  const sex = effectiveRef(child);
  const hs = heightSeries(memories, child.id), ws = weightSeries(memories, child.id), hcs = headSeries(memories, child.id);
  const days = [...new Set([...hs, ...ws, ...hcs].map((e) => e.date))].sort();
  const [back, setBack] = useState(0); // how many measuring days back from the latest
  const at = Math.max(0, days.length - 1 - back);
  const day = days[at];
  const asOf = <T extends { date: string },>(l: T[]) => [...l].reverse().find((e) => e.date <= day);
  const h = day ? asOf(hs) : undefined;
  const w = day ? asOf(ws) : undefined;
  const hc = day ? asOf(hcs) : undefined;
  if (!days.length) return null;
  const arrow = (dir: -1 | 1) => {
    const off = dir < 0 ? at === 0 : back === 0;
    return (
      <Pressable onPress={() => setBack((b) => b - dir)} disabled={off} accessibilityRole="button" accessibilityLabel={dir < 0 ? tr("Earlier measurements") : tr("Later measurements")}
        hitSlop={8} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: off ? "transparent" : t.bg2 }}>
        <Icon name={dir < 0 ? "chevron-left" : "chevron-right"} size={22} color={off ? t.outline : t.ink} />
      </Pressable>
    );
  };

  const pct = (m: Measure, date: string, value: number) => percentileFor(source, m, sex, ageInMonths(child.birth, date), value);
  const ph = h ? pct("height", h.date, h.cm) : null;
  const pw = w ? pct("weight", w.date, w.kg) : null;
  const phc = hc ? pct("head", hc.date, hc.cm) : null;
  // the two are only compared when measured close together (within a month)
  const together = h && w && Math.abs(new Date(h.date).getTime() - new Date(w.date).getTime()) <= 31 * 86400000;
  const step = ph && pw && together ? inStep(ph, pw) : null;

  const cell = (label: string, value: string | null, date: string | undefined, p: Percentile | null) => (
    <View style={{ flex: 1, backgroundColor: t.bg2, borderRadius: 16, padding: 12 }}>
      <Text style={[TYPE.labelMedium, { color: t.ink3 }]}>{label}</Text>
      {value && date ? (
        <>
          <Text style={[TYPE.titleLarge, { color: t.ink, marginTop: 2 }]}>{value}</Text>
          <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{atAge(child.birth, date)}{date !== day ? ` · ${tr("measured {0}", [formatDate(date)])}` : ""}</Text>
          <Text style={[TYPE.labelLarge, { color: t.accentDeep, marginTop: 4 }]}>{p ? percentileLabel(p.percentile) : tr("Past the chart's ages")}</Text>
        </>
      ) : (
        <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 4 }]}>{tr("Not measured yet")}</Text>
      )}
    </View>
  );

  return (
    <View style={{ backgroundColor: t.card, borderRadius: 22, borderWidth: 1, borderColor: t.line, padding: 14, marginTop: 14 }}>
      {/* the date these are from: the latest, or an earlier day stepped back to */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
        {arrow(-1)}
        <View style={{ flex: 1, alignItems: "center" }} accessibilityLiveRegion="polite">
          <Text style={[TYPE.titleSmall, { color: t.ink }]}>{formatDate(day)}</Text>
          <Text style={[TYPE.labelSmall, { color: t.ink3 }]}>{back === 0 ? tr("Latest") : tr("{0} of {1} measuring days", [at + 1, days.length])}</Text>
        </View>
        {arrow(1)}
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {cell(tr("Height"), h ? formatHeight(h.cm, hUnit) : null, h?.date, ph)}
        {cell(tr("Weight"), w ? formatWeight(w.kg, wUnit) : null, w?.date, pw)}
      </View>
      <View style={{ marginTop: 10 }}>{cell(tr("Head circumference"), hc ? formatHeight(hc.cm, hUnit) : null, hc?.date, phc)}</View>
      {step ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
          <Icon name={step === "in-step" ? "check" : "info"} size={18} color={t.accentDeep} />
          <Text style={[TYPE.bodyMedium, { color: t.ink, flex: 1 }]}>{IN_STEP_TEXT[step]}</Text>
        </View>
      ) : null}
      <Pressable onPress={() => router.push("/settings")} accessibilityRole="button" hitSlop={6} style={{ marginTop: 10 }}>
        <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>
          {CHART_SOURCES.find((c) => c.id === source)?.label} {tr("charts, compared with")} {sex === "girl" ? tr("girls") : sex === "boy" ? tr("boys") : tr("girls and boys")}. <Text style={{ color: t.accentDeep, fontWeight: "700" }}>{tr("Change charts")}</Text>
        </Text>
      </Pressable>
    </View>
  );
}
