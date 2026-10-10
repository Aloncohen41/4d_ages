import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useActiveChild, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { MILESTONE_CATALOG } from "../lib/types";
import { milestonesLogged } from "../lib/selectors";
import { AREA_META, areaInk, areaSoft, AreaReport, STATUS_COPY, Status, activitiesFor, ageLabel, ageMonths, analyze, bandLabel, highlightText, reachedText, reinforceBand } from "../lib/development";
import { todayISO } from "../lib/date";
import { Btn, Sheet } from "./ui";
import { Icon, IconName } from "./Icon";

/** The button beside the Milestones title that opens the Reinforce view. */
export function ReinforceButton({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityLabel="Reinforce" style={{ flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 99, paddingLeft: 6, paddingRight: 13, paddingVertical: 6 }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.accentDeep, alignItems: "center", justifyContent: "center" }}><Icon name="arrow-up-right" size={16} color={t.onAccent} /></View>
      <Text style={{ color: t.ink, fontWeight: "700", fontSize: 13 }}>Reinforce</Text>
    </Pressable>
  );
}

const ORDER: Status[] = ["outstanding", "ontrack", "reinforce", "unanswered"];

/**
 * "Reinforce": what they're really good at, and where a little extra play could help — drawn only from milestones you've
 * answered. It never shows a total to compare against, and an area with nothing marked is just "to explore", not "behind".
 */
export function ReinforceSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const child = useActiveChild();
  const memories = useStore((s) => s.memories);
  const answers = useStore((s) => s.milestoneAnswers);
  const [open, setOpen] = useState<Record<Status, boolean>>({ outstanding: true, ontrack: false, reinforce: true, unanswered: false });

  const months = child ? ageMonths(child.birth, todayISO()) : 0;
  const dev = useMemo(() => (child ? analyze(MILESTONE_CATALOG, milestonesLogged(memories, child.id), answers[child.id] || {}, months) : null), [child, memories, answers, months]);
  if (!child || !dev) return null;

  const color: Record<Status, string> = { outstanding: t.gold, ontrack: "#3FAE5A", reinforce: t.accentDeep, unanswered: t.ink3 };
  const icon: Record<Status, IconName> = { outstanding: "star", ontrack: "check", reinforce: "arrow-up-right", unanswered: "help-circle" };
  const phrases = dev.reinforce.map((r) => AREA_META[r.area].phrase);
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

  const renderArea = (r: AreaReport) => {
    const meta = AREA_META[r.area];
    const band = reinforceBand(r, months);
    return (
      <View key={r.area} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.line }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: areaSoft(meta, t), borderWidth: 2, borderColor: areaInk(meta, t), alignItems: "center", justifyContent: "center" }}><Icon name={meta.icon as IconName} size={16} color={areaInk(meta, t)} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15 }}>{meta.label}</Text>
            {r.reached > 0 ? <Text style={{ color: t.ink3, fontSize: 12.5 }}>{reachedText(r.reached)}</Text> : null}
          </View>
        </View>
        {r.status === "outstanding" && r.ahead.length ? <Text style={{ color: t.ink2, fontSize: 13, lineHeight: 19, marginTop: 8 }}>Already reached {r.ahead.slice(0, 2).map((d) => `“${d.label}”`).join(" and ")}{r.ahead.length > 2 ? ` and ${r.ahead.length - 2} more` : ""}, ahead of the usual timing.</Text> : null}
        {r.status === "reinforce" ? (
          <View style={{ marginTop: 10, backgroundColor: t.bg2, borderRadius: 14, padding: 12 }}>
            <Text style={{ color: t.ink, fontWeight: "700", fontSize: 13 }}>Try this together <Text style={{ color: t.ink3, fontWeight: "600" }}>· {bandLabel(band)} ideas</Text></Text>
            {activitiesFor(r.area, band).map((a) => (
              <View key={a} style={{ flexDirection: "row", gap: 8, marginTop: 7 }}>
                <Text style={{ color: areaInk(meta, t), fontWeight: "700" }}>•</Text>
                <Text style={{ flex: 1, color: t.ink2, fontSize: 13.5, lineHeight: 19 }}>{a}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {r.status === "unanswered" && r.toCheck.length ? <Text style={{ color: t.ink3, fontSize: 12.5, lineHeight: 18, marginTop: 6 }}>Worth a look: {r.toCheck.slice(0, 2).map((d) => d.label).join(", ")}</Text> : null}
      </View>
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`${child.name}'s Development Journey`}>
      <Text style={{ color: t.ink3, fontStyle: "italic", marginTop: -6, marginBottom: 12 }}>{ageLabel(months)}</Text>

      {/* the headline: wow, they're good at … */}
      <View style={{ backgroundColor: t.accentSoft, borderRadius: 20, padding: 16, flexDirection: "row", gap: 14 }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.gold, alignItems: "center", justifyContent: "center" }}><Icon name="star" size={22} color={t.goldInk} /></View>
        <View style={{ flex: 1 }}>
          {dev.highlight ? (
            <>
              <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15.5, lineHeight: 21 }}>{highlightText(child.name, dev.highlight)}</Text>
              {dev.reinforce.length ? <Text style={{ color: t.ink2, fontSize: 13.5, lineHeight: 19, marginTop: 8 }}>Here's how to give {list(phrases)} a little boost — a few ideas to play with below.</Text> : <Text style={{ color: t.ink2, fontSize: 13.5, lineHeight: 19, marginTop: 8 }}>Everything you've ticked looks right where it should be. 🎉</Text>}
            </>
          ) : dev.reinforce.length ? (
            <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15.5, lineHeight: 21 }}>Here's how to give {list(phrases)} a little boost — a few ideas to play with below.</Text>
          ) : (
            <Text style={{ color: t.ink, fontWeight: "700", fontSize: 15.5, lineHeight: 21 }}>Tick a few milestones and I'll tell you what {child.name} is brilliant at.</Text>
          )}
        </View>
      </View>

      {ORDER.map((status) => {
        const rows = dev.areas.filter((a) => a.status === status);
        if (!rows.length) return null;
        const isOpen = open[status];
        return (
          <View key={status} style={{ backgroundColor: t.card, borderRadius: 20, borderWidth: 1, borderColor: t.line, marginTop: 14, overflow: "hidden" }}>
            <Pressable onPress={() => setOpen((o) => ({ ...o, [status]: !o[status] }))} style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14 }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 3, borderColor: color[status], alignItems: "center", justifyContent: "center" }}><Icon name={icon[status]} size={22} color={color[status]} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.ink, fontWeight: "700", fontSize: 17 }}>{STATUS_COPY[status].title}</Text>
                <Text style={{ color: t.ink3, fontSize: 12.5, fontStyle: "italic" }}>{STATUS_COPY[status].sub}</Text>
              </View>
              <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={20} color={t.accentDeep} />
            </Pressable>
            {isOpen ? <View style={{ paddingHorizontal: 14, paddingBottom: 4 }}>{rows.map((r) => renderArea(r))}</View> : null}
          </View>
        );
      })}

      <Btn label="Back to the checklist" kind="line" onPress={onClose} style={{ marginTop: 18 }} />
      <Text style={{ color: t.ink4, fontSize: 11.5, lineHeight: 17, marginTop: 14, textAlign: "center" }}>
        Every child develops at their own pace. Milestones are a roadmap, not rigid expectations. If you have questions or concerns, talk with your pediatrician.{"\n"}
        Milestone ages follow ZERO TO THREE's “Developmental Milestones by Age” (birth to 36 months). Always supervise play.
      </Text>
    </Sheet>
  );
}
