import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { Memory } from "../lib/types";
import { MONTH_NAMES, Period, dateIndex, periodLabel } from "../lib/dates";
import { searchMemories } from "../lib/search";
import { blurb } from "../lib/display";
import { TYPE_META } from "../lib/entries";
import { formatDate } from "../lib/date";
import { openMemory } from "../lib/openMemory";
import { Btn, Input, Sheet } from "./ui";
import { Icon } from "./Icon";

/**
 * Search the story by words, or jump to a date. Only years, months and days that really contain something are offered,
 * so there is never an empty result to land on.
 */
export function SearchSheet({ memories, period, onPeriod, onClose }: { memories: Memory[]; period: Period | null; onPeriod: (p: Period | null) => void; onClose: () => void }) {
  const t = useTheme();
  const tags = useStore((s) => s.tags);
  const relatives = useStore((s) => s.relatives);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<number | null>(period?.year ?? null);
  const [month, setMonth] = useState<number | null>(period?.month ?? null);

  const index = useMemo(() => dateIndex(memories), [memories]);
  const results = useMemo(() => searchMemories(memories, query, tags, relatives), [memories, query, tags, relatives]);
  const y = index.find((x) => x.year === year);
  const m = y?.months.find((x) => x.month === month);

  const apply = (p: Period | null) => {
    onPeriod(p);
    onClose();
  };
  const chip = (on: boolean) => ({ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: on ? t.chipOn : t.card, borderWidth: 1, borderColor: on ? t.chipOn : t.line } as const);

  return (
    <Sheet visible onClose={onClose} title="Search the story">
      <Input value={query} onChangeText={setQuery} placeholder="Search words, places, people, tags…" returnKeyType="search" autoCapitalize="none" />

      {query.trim() ? (
        <View style={{ marginTop: 14 }}>
          {results.length ? (
            results.map((r) => (
              <Pressable key={r.id} onPress={() => { onClose(); setTimeout(() => openMemory(r), 250); }} style={{ backgroundColor: t.card, borderRadius: 12, borderWidth: 1, borderColor: t.line, padding: 10, marginBottom: 8 }}>
                <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 11 }}>{TYPE_META[r.type].emoji} {TYPE_META[r.type].label} · {formatDate(r.date)}</Text>
                <Text style={{ color: t.ink, fontWeight: "700" }} numberOfLines={2}>{blurb(r) || TYPE_META[r.type].label}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={{ color: t.ink3, textAlign: "center", padding: 20 }}>Nothing matches “{query.trim()}”.</Text>
          )}
        </View>
      ) : (
        <View style={{ marginTop: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Icon name="calendar" size={16} color={t.ink2} />
            <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 13 }}>Jump to a date</Text>
          </View>

          {!index.length ? <Text style={{ color: t.ink3 }}>There's nothing in the story yet.</Text> : null}

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {index.map((x) => (
              <Pressable key={x.year} onPress={() => { setYear(x.year === year ? null : x.year); setMonth(null); }} style={chip(x.year === year)}>
                <Text style={{ color: x.year === year ? t.onChipOn : t.ink2, fontWeight: "700" }}>{x.year} <Text style={{ fontWeight: "600", opacity: 0.75 }}>· {x.count}</Text></Text>
              </Pressable>
            ))}
          </View>

          {y ? (
            <View style={{ marginTop: 14 }}>
              <Btn label={`Show all of ${y.year}`} kind="line" onPress={() => apply({ year: y.year })} style={{ paddingVertical: 10 }} />
              <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12, marginTop: 12, marginBottom: 8 }}>Months with something in them</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {y.months.map((mm) => (
                  <Pressable key={mm.month} onPress={() => setMonth(mm.month === month ? null : mm.month)} style={chip(mm.month === month)}>
                    <Text style={{ color: mm.month === month ? t.onChipOn : t.ink2, fontWeight: "700" }}>{MONTH_NAMES[mm.month - 1].slice(0, 3)} <Text style={{ fontWeight: "600", opacity: 0.75 }}>· {mm.count}</Text></Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {y && m ? (
            <View style={{ marginTop: 14 }}>
              <Btn label={`Show all of ${MONTH_NAMES[m.month - 1]} ${y.year}`} kind="line" onPress={() => apply({ year: y.year, month: m.month })} style={{ paddingVertical: 10 }} />
              <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12, marginTop: 12, marginBottom: 8 }}>Days with something in them</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {m.days.map((d) => (
                  <Pressable key={d.day} onPress={() => apply({ year: y.year, month: m.month, day: d.day })} style={chip(false)}>
                    <Text style={{ color: t.ink2, fontWeight: "700" }}>{d.day} <Text style={{ fontWeight: "600", opacity: 0.75 }}>· {d.count}</Text></Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {period ? <Btn label={`Clear “${periodLabel(period)}”`} kind="soft" onPress={() => apply(null)} style={{ marginTop: 18 }} /> : null}
        </View>
      )}
    </Sheet>
  );
}
