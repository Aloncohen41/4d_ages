import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Page } from "../src/components/Page";
import { Btn } from "../src/components/ui";
import { Icon } from "../src/components/Icon";
import { HEALTH_KINDS } from "../src/components/EntrySheet";
import { useShownChild, useStore } from "../src/lib/store";
import { useTheme } from "../src/lib/useTheme";
import { byMoment } from "../src/lib/display";
import { ageShort, formatDate } from "../src/lib/date";
import { HealthKind } from "../src/lib/types";
import { TYPE } from "../src/theme";
import { router } from "expo-router";
import { foodById } from "../src/lib/foods";

import { tr } from "../src/lib/i18n";
/** Reactions noted in First foods, at the top of Health: what, when, and how bad. */
function FoodReactions({ childId }: { childId: string }) {
  const t = useTheme();
  const tries = useStore((s) => s.foodTries);
  const list = tries.filter((x) => x.childId === childId && x.reaction && x.reaction !== "none").sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length) return null;
  return (
    <Pressable onPress={() => router.push("/foods")} accessibilityRole="link" style={{ marginBottom: 16, padding: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1, borderColor: t.danger }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name="alert-triangle" size={18} color={t.danger} />
        <Text style={[TYPE.titleSmall, { color: t.ink, flex: 1 }]}>{tr("Food reactions")}</Text>
        <Icon name="chevron-right" size={18} color={t.ink3} />
      </View>
      {list.slice(0, 5).map((x) => (
        <Text key={x.id} style={[TYPE.bodySmall, { color: t.ink2, marginTop: 6 }]}>
          {formatDate(x.date)} · {foodById(x.food)?.name ?? x.food} · <Text style={{ color: t.danger, fontWeight: "700" }}>{x.reaction === "serious" ? "serious" : "mild"}</Text>{x.note ? ` · ${x.note}` : ""}
        </Text>
      ))}
    </Pressable>
  );
}

/**
 * The health log: check-ups, vaccinations, illnesses and medicines, newest first. Kept apart from the story and the book. Each entry is added
 * by hand (the date, what it was, notes, where), and can be filtered by kind.
 */
export default function HealthPage() {
  const t = useTheme();
  const child = useShownChild();
  const memories = useStore((s) => s.memories);
  const setEntrySheet = useStore((s) => s.setEntrySheet);
  const [kind, setKind] = useState<HealthKind | "all">("all");
  const entries = useMemo(
    () => (child ? memories.filter((m) => m.childId === child.id && m.type === "health" && (kind === "all" || m.healthKind === kind)).sort((a, b) => byMoment(b, a)) : []),
    [memories, child, kind]
  );
  if (!child) return null;
  const viewOnly = child.role === "viewer";
  const label = (k?: HealthKind) => HEALTH_KINDS.find((x) => x.id === k)?.label ?? "Other";
  const pill = (on: boolean) => ({ paddingHorizontal: 13, paddingVertical: 7, borderRadius: 12, backgroundColor: on ? t.chipOn : t.card, borderWidth: 1, borderColor: on ? t.chipOn : t.line } as const);

  return (
    <Page title={tr("{0}'s health", [child.name])}>
      <FoodReactions childId={child.id} />
      {viewOnly ? null : (
        <>
          <Btn label={tr("Add a health entry")} icon="health" onPress={() => setEntrySheet({ kind: "health", healthKind: kind === "all" ? "checkup" : kind })} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {HEALTH_KINDS.filter((k) => k.id !== "other").map((k) => (
              <Pressable key={k.id} onPress={() => setEntrySheet({ kind: "health", healthKind: k.id })} accessibilityRole="button" style={pill(false)}>
                <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12 }}>{tr("Add {0}", [k.label.toLowerCase()])}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 18, marginBottom: 8 }}>
        {[{ id: "all" as const, label: tr("All") }, ...HEALTH_KINDS].map((k) => (
          <Pressable key={k.id} onPress={() => setKind(k.id)} accessibilityRole="radio" aria-checked={kind === k.id} style={pill(kind === k.id)}>
            <Text style={{ color: kind === k.id ? t.onChipOn : t.ink2, fontWeight: "700", fontSize: 12 }}>{k.label}</Text>
          </Pressable>
        ))}
      </View>

      {entries.length === 0 ? (
        <View style={{ alignItems: "center", padding: 28 }}>
          <Icon name="health" size={40} color={t.ink3} />
          <Text style={{ color: t.ink3, textAlign: "center", marginTop: 6 }}>{kind === "all" ? tr("Nothing here yet. Add check-ups, vaccinations, illnesses and medicines to keep them in one place.") : tr("No {0} entries yet.", [label(kind).toLowerCase()])}</Text>
        </View>
      ) : (
        entries.map((m) => (
          <Pressable key={m.id} onPress={() => !viewOnly && setEntrySheet({ kind: "health", editId: m.id })} accessibilityRole="button"
            style={{ flexDirection: "row", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, marginBottom: 8 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.bg2, alignItems: "center", justifyContent: "center" }}><Icon name="health" size={20} color={t.ink2} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[TYPE.labelMedium, { color: t.accentDeep }]}>{label(m.healthKind)}</Text>
              <Text style={[TYPE.titleSmall, { color: t.ink }]}>{m.title || label(m.healthKind)}</Text>
              <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{formatDate(m.date)} · {ageShort(child.birth, m.date)}{m.location ? ` · ${m.location}` : ""}</Text>
              {m.description ? <Text style={[TYPE.bodyMedium, { color: t.ink2, marginTop: 4 }]}>{m.description}</Text> : null}
            </View>
          </Pressable>
        ))
      )}
      <Text style={[TYPE.bodySmall, { color: t.ink4, marginTop: 12 }]}>{tr("Health notes stay out of the story and the book. For information only: always follow your doctor's advice.")}</Text>
    </Page>
  );
}
