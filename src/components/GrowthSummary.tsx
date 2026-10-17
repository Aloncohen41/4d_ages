import React from "react";
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
/**
 * The latest height (left), weight (right) and head circumference, each with its percentile for their age and sex on the chosen charts, and
 * whether height and weight are growing in step. A measurement past the ages a chart covers shows without a percentile.
 */
export function GrowthSummary({ child, memories }: { child: Child; memories: Memory[] }) {
  const t = useTheme();
  const source = useStore((s) => s.growthChart);
  const hUnit = useStore((s) => s.heightUnit);
  const wUnit = useStore((s) => s.weightUnit);
  const sex = effectiveRef(child);
  const last = <T,>(l: T[]) => l[l.length - 1];
  const h = last(heightSeries(memories, child.id));
  const w = last(weightSeries(memories, child.id));
  const hc = last(headSeries(memories, child.id));
  if (!h && !w && !hc) return null;

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
          <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{atAge(child.birth, date)}</Text>
          <Text style={[TYPE.labelLarge, { color: t.accentDeep, marginTop: 4 }]}>{p ? percentileLabel(p.percentile) : tr("Past the chart's ages")}</Text>
        </>
      ) : (
        <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 4 }]}>{tr("Not measured yet")}</Text>
      )}
    </View>
  );

  return (
    <View style={{ backgroundColor: t.card, borderRadius: 22, borderWidth: 1, borderColor: t.line, padding: 14, marginTop: 14 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {cell("Height", h ? formatHeight(h.cm, hUnit) : null, h?.date, ph)}
        {cell("Weight", w ? formatWeight(w.kg, wUnit) : null, w?.date, pw)}
      </View>
      <View style={{ marginTop: 10 }}>{cell("Head circumference", hc ? formatHeight(hc.cm, hUnit) : null, hc?.date, phc)}</View>
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
