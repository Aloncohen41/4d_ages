import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Child, Memory } from "../lib/types";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { onThisDay, monthlyPhotoDue } from "../lib/remember";
import { pickMedia, toMediaItems } from "../lib/media";
import { blurb } from "../lib/display";
import { pregnancy, todayISO } from "../lib/date";
import { BUMP_SOURCE, weekOn } from "../lib/pregnancy";
import { BumpTips, useAddBumpPhoto } from "./Pregnancy";
import { TYPE_META } from "../lib/entries";
import { TYPE } from "../theme";
import { HScroll } from "./HScroll";
import { Btn, PhotoView } from "./ui";
import { Icon } from "./Icon";

import { tr } from "../lib/i18n";
/**
 * Cards at the top of Home, only when there's something to show: "On this day" (what happened on today's date in earlier years), in the
 * first year the monthly photo that's due for the Monthly photos page, and in a pregnancy this week's bump photo (with the tips).
 */
export function HomeCards({ child, onView }: { child: Child; onView: (m: Memory) => void }) {
  const t = useTheme();
  const memories = useStore((s) => s.memories);
  const classics = useStore((s) => s.classics);
  const saveClassic = useStore((s) => s.saveClassic);
  const [hidden, setHidden] = useState(false);
  const [bumpHidden, setBumpHidden] = useState(false);
  const [tips, setTips] = useState(false);
  const addBump = useAddBumpPhoto(child);
  const today = todayISO();
  const past = useMemo(() => onThisDay(memories, child.id, today), [memories, child.id, today]);
  const due = useMemo(() => (child.role === "viewer" ? null : monthlyPhotoDue(child, classics, today)), [child, classics, today]);
  // a pregnancy: this week's bump photo, until it's taken
  const bumpWeek = child.expecting && child.role !== "viewer" ? pregnancy(child.birth, today).week : 0;
  const bumpDone = useMemo(() => !bumpWeek || memories.some((m) => m.childId === child.id && m.source === BUMP_SOURCE && weekOn(child.birth, m.date) === bumpWeek), [memories, child.id, child.birth, bumpWeek]);

  const addMonthly = async () => {
    if (!due) return;
    const picked = await pickMedia({ videos: false, multiple: false });
    if (!picked.length) return;
    const grid = classics.find((c) => c.childId === child.id && c.id === "grid");
    saveClassic(child.id, "grid", grid?.values ?? {}, { ...(grid?.photos ?? {}), [`m${due.month}`]: toMediaItems(picked) });
  };

  const card = { backgroundColor: t.card, borderRadius: 18, borderWidth: 1, borderColor: t.line, padding: 14, marginBottom: 12 } as const;
  return (
    <View>
      {due && !hidden ? (
        <View style={[card, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }}><Icon name="images" size={22} color={t.onAccentSoft} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[TYPE.titleSmall, { color: t.ink }]}>{child.name} is {due.month === 12 ? "one" : tr("{0} month{1} old", [due.month, due.month === 1 ? "" : "s"])}!</Text>
            <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{tr("Add this month's photo to the Monthly photos page.")}</Text>
            <Btn label={tr("Add the {0}-month photo", [due.month])} icon="image" kind="soft" onPress={addMonthly} style={{ marginTop: 8, paddingVertical: 8 }} />
          </View>
          <Pressable onPress={() => setHidden(true)} accessibilityLabel={tr("Not now")} hitSlop={8} style={{ alignSelf: "flex-start" }}><Icon name="x" size={18} color={t.ink3} /></Pressable>
        </View>
      ) : null}

      {bumpWeek && !bumpDone && !bumpHidden ? (
        <View style={card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 22 }}>🤰</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[TYPE.titleSmall, { color: t.ink }]}>{tr("Week {0}: time for the bump photo", [bumpWeek])}</Text>
              <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{tr("Same spot, same pose, same light. After the birth they play as a video of the bump growing.")}</Text>
            </View>
            <Pressable onPress={() => setBumpHidden(true)} accessibilityLabel={tr("Not now")} hitSlop={8} style={{ alignSelf: "flex-start" }}><Icon name="x" size={18} color={t.ink3} /></Pressable>
          </View>
          <Btn label={tr("Add the week {0} photo", [bumpWeek])} icon="image" kind="soft" onPress={addBump} style={{ marginTop: 10, paddingVertical: 8 }} />
          <Pressable onPress={() => setTips((v) => !v)} hitSlop={6} style={{ marginTop: 8 }}><Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>{tips ? tr("Hide the tips") : tr("Tips for photos that line up")}</Text></Pressable>
          {tips ? <BumpTips /> : null}
        </View>
      ) : null}

      {past.length ? (
        <View style={card}>
          <Text style={[TYPE.titleSmall, { color: t.ink, marginBottom: 8 }]}>{tr("On this day")}</Text>
          <HScroll contentContainerStyle={{ gap: 10 }}>
            {past.slice(0, 10).map(({ memory: m, yearsAgo }) => (
              <Pressable key={m.id} onPress={() => onView(m)} accessibilityRole="button" accessibilityLabel={tr("{0} year{1} ago: {2}", [yearsAgo, yearsAgo === 1 ? "" : "s", blurb(m) || TYPE_META[m.type].label])} style={{ width: 128 }}>
                <PhotoView photo={m} emojiSize={30} style={{ width: 128, height: 96, borderRadius: 12 }} />
                <Text style={[TYPE.labelMedium, { color: t.accentDeep, marginTop: 4 }]}>{yearsAgo} year{yearsAgo === 1 ? "" : "s"} ago</Text>
                <Text style={[TYPE.bodySmall, { color: t.ink2 }]} numberOfLines={2}>{blurb(m) || TYPE_META[m.type].label}</Text>
              </Pressable>
            ))}
          </HScroll>
        </View>
      ) : null}
    </View>
  );
}
