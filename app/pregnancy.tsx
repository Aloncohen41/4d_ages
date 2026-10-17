import React, { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Page } from "../src/components/Page";
import { Seg } from "../src/components/ui";
import { PregnancyGrowth, PregnancyMilestones } from "../src/components/Pregnancy";
import { PregnancyNotes } from "../src/components/PregnancyNotes";
import { useStore } from "../src/lib/store";
import { useTheme } from "../src/lib/useTheme";
import { formatDate } from "../src/lib/date";
import { TYPE } from "../src/theme";

import { tr } from "../src/lib/i18n";
type Section = "milestones" | "symptoms" | "cravings" | "growth";

/**
 * "Tell us how your pregnancy was": the pregnancy pages for a child who's already born (or who was added after the birth). The same
 * milestones, symptoms, cravings, scans and bump photos as a pregnancy profile, looking back: dates end the day before the birth, the weeks are
 * counted back from the birthday, and there are no tips or warnings. Everything goes into the book before the birth.
 */
export default function PregnancyPage() {
  const t = useTheme();
  const { child: id } = useLocalSearchParams<{ child?: string }>();
  const child = useStore((s) => s.kids.find((k) => k.id === id) ?? s.kids.find((k) => k.id === s.activeId));
  const [section, setSection] = useState<Section>("milestones");
  if (!child) return null;
  return (
    <Page title={tr("Your pregnancy with {0}", [child.name])}>
      <Text style={[TYPE.bodyMedium, { color: t.ink2, marginBottom: 12 }]}>
        {tr("Looking back on the months before {0} arrived on {1}. Add as much or as little as you remember: it all goes into the book, before the day they were born.", [child.name, formatDate(child.birth)])}
      </Text>
      <View style={{ marginBottom: 14 }}>
        <Seg options={[{ id: "milestones" as Section, label: tr("Milestones") }, { id: "symptoms" as Section, label: tr("Symptoms") }, { id: "cravings" as Section, label: tr("Cravings") }, { id: "growth" as Section, label: tr("Scans") }]} value={section} onChange={setSection} />
      </View>
      {section === "milestones" ? <PregnancyMilestones child={child} /> : section === "growth" ? <PregnancyGrowth child={child} /> : <PregnancyNotes child={child} kind={section === "symptoms" ? "symptom" : "craving"} />}
    </Page>
  );
}
