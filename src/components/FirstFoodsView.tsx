import React, { useMemo, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { Btn, Input } from "./ui";
import { Icon } from "./Icon";
import { HScroll } from "./HScroll";
import { FoodSheet, FoodTile, LogTrySheet, statusColour } from "./FirstFoods";
import { useShownChild, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { withAlpha } from "../lib/m3";
import { ALLERGENS, FOOD_GROUPS, Food, FoodGroup, FoodStatus, NHS_WEANING_URL, allergenNotes, allergenProgress, foodProgress, suggestions } from "../lib/foods";
import { shareFoodSummary } from "../lib/foodSummary";
import { daysBetween, todayISO } from "../lib/date";
import { TYPE } from "../theme";

import { tr } from "../lib/i18n";
/*
 * First foods: the progress at the top (foods tried, allergens done), what to try next, then the foods one group at a time (allergens
 * first), each a tile with its three tries as dots. Tap a food to see it and log a try; "Log a meal" picks several at once. Reactions show
 * on the tiles and in Health, and the summary for the doctor is one tap away.
 */
const FILTERS: { id: "all" | FoodStatus; label: string }[] = [
  { id: "all", get label() { return tr("All"); } }, { id: "trying", get label() { return tr("Trying"); } }, { id: "new", get label() { return tr("Not tried"); } }, { id: "done", get label() { return tr("Done"); } }, { id: "reaction", get label() { return tr("Reactions"); } },
];

/** First foods, the whole of it: the Milestones tab's First foods section, and its own page (opened by "Food tried" in the + menu). */
export function FirstFoodsView({ startMeal = false }: { startMeal?: boolean }) {
  const t = useTheme();
  const child = useShownChild();
  const tries = useStore((s) => s.foodTries);
  const [group, setGroup] = useState<FoodGroup>("allergens");
  const [filter, setFilter] = useState<"all" | FoodStatus>("all");
  const [query, setQuery] = useState("");
  const [meal, setMeal] = useState<string[] | null>(startMeal ? [] : null); // choosing a meal: the foods ticked so far
  const [open, setOpen] = useState<Food | null>(null);
  const [logging, setLogging] = useState<Food[] | null>(null);
  const progress = useMemo(() => (child ? foodProgress(tries, child.id) : new Map()), [tries, child]);
  if (!child) return null;

  const months = daysBetween(child.birth, todayISO()) / 30.4375;
  const all = [...progress.values()];
  const allergens = allergenProgress(progress);
  const notes = allergenNotes(tries, child.id, todayISO());
  const next = suggestions(progress, months);
  const q = query.trim().toLowerCase();
  const shown = all
    .filter((p) => (q ? p.food.name.toLowerCase().includes(q) : group === "allergens" ? !!p.food.allergen : p.food.group === group && !p.food.allergen))
    .filter((p) => filter === "all" || p.status === filter)
    // the allergens in the NHS's order (milk, egg, gluten, peanut…), not the order of the food groups
    .sort((x, y) => (group === "allergens" && !q ? ALLERGENS.findIndex((a) => a.id === x.food.allergen) - ALLERGENS.findIndex((a) => a.id === y.food.allergen) : 0));
  const tried = all.filter((p) => p.tries).length;
  const allergensDone = allergens.filter((a) => a.status === "done").length;
  const tap = (f: Food) => (meal ? setMeal(meal.includes(f.id) ? meal.filter((x) => x !== f.id) : [...meal, f.id]) : setOpen(f));

  const ring = (label: string, n: number, of: number) => (
    <View style={{ flex: 1, padding: 14, borderRadius: 20, backgroundColor: t.card, borderWidth: 1, borderColor: t.line }} accessible accessibilityLabel={tr("{0}: {1} of {2}", [label, n, of])}>
      <Text style={[TYPE.labelLarge, { color: t.ink2 }]}>{label}</Text>
      <Text style={[TYPE.headlineSmall, { color: t.ink, marginTop: 2 }]}>{n}<Text style={[TYPE.bodyMedium, { color: t.ink3 }]}> {tr("of {0}", [of])}</Text></Text>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: withAlpha(t.accent, 0.16), marginTop: 8, overflow: "hidden" }}>
        <View style={{ width: `${Math.round((n / Math.max(1, of)) * 100)}%`, height: 8, borderRadius: 4, backgroundColor: t.accent }} />
      </View>
    </View>
  );

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {ring("Foods tried", tried, all.length)}
        {ring("Allergens done", allergensDone, allergens.length)}
      </View>

      {notes.wait ? <Note icon="clock" text={tr("{0} was new in the last two days. Wait a couple of days before the next new allergen, so you can tell what caused any reaction.", [notes.wait])} /> : null}
      {notes.keepUp.length ? <Note icon="refresh-cw" text={tr("Keep them in the diet: {0} not given for over a week. The NHS suggests giving allergens regularly once they're in.", [notes.keepUp.join(", ")])} /> : null}

      {next.length && !meal ? (
        <View style={{ marginTop: 14 }}>
          <Text style={[TYPE.titleSmall, { color: t.ink, marginBottom: 6 }]}>{tr("Try next")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {next.map((f) => (
              <Pressable key={f.id} onPress={() => setLogging([f])} accessibilityRole="button" accessibilityLabel={tr("Log a try of {0}", [f.name])} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: t.chipOn }}>
                <Text style={{ fontSize: 18 }}>{f.emoji}</Text><Text style={[TYPE.labelLarge, { color: t.onChipOn }]}>{f.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
        {meal ? (
          <>
            <Btn label={tr("Cancel")} kind="soft" onPress={() => setMeal(null)} style={{ flex: 1 }} />
            <Btn label={meal.length ? tr("Log {0} food{1}", [meal.length, meal.length === 1 ? "" : "s"]) : tr("Tick the foods")} disabled={!meal.length} onPress={() => setLogging(meal.map((id) => progress.get(id)!.food))} style={{ flex: 2 }} />
          </>
        ) : (
          <>
            <Btn label={tr("Log a meal")} icon="plus" onPress={() => setMeal([])} style={{ flex: 1 }} />
            <Btn label={tr("Doctor summary")} icon="download" kind="soft" onPress={() => shareFoodSummary(child, tries, todayISO())} style={{ flex: 1 }} />
          </>
        )}
      </View>
      {meal ? <Text style={[TYPE.bodySmall, { color: t.ink2, marginTop: 8 }]}>{tr("Tick everything they ate together, from any group, then log them in one go.")}</Text> : null}

      <View style={{ marginTop: 16 }}>
        <Input value={query} onChangeText={setQuery} placeholder={tr("Search foods")} accessibilityLabel={tr("Search foods")} autoCorrect={false} style={{ paddingLeft: 44 }} />
        <View pointerEvents="none" style={{ position: "absolute", left: 14, top: 0, bottom: 0, justifyContent: "center" }}><Icon name="search" size={20} color={t.ink3} /></View>
      </View>
      {!q ? (
        <View accessibilityRole="radiogroup" accessibilityLabel={tr("Food group")}>
        <HScroll contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
          {FOOD_GROUPS.map((g) => (
            <Pressable key={g.id} onPress={() => setGroup(g.id)} accessibilityRole="radio" aria-checked={group === g.id} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, backgroundColor: group === g.id ? t.chipOn : "transparent", borderWidth: 1, borderColor: group === g.id ? t.chipOn : t.outline }}>
              <Text style={[TYPE.labelLarge, { color: group === g.id ? t.onChipOn : t.ink }]}>{g.label}</Text>
            </Pressable>
          ))}
        </HScroll>
        </View>
      ) : null}
      <View accessibilityRole="radiogroup" accessibilityLabel={tr("Show")}>
      <HScroll contentContainerStyle={{ gap: 6, paddingBottom: 10 }}>
        {FILTERS.map((f) => (
          <Pressable key={f.id} onPress={() => setFilter(f.id)} accessibilityRole="radio" aria-checked={filter === f.id} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 14, backgroundColor: filter === f.id ? t.bg2 : "transparent" }}>
            {f.id !== "all" ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColour(t, f.id) }} /> : null}
            <Text style={[TYPE.labelMedium, { color: filter === f.id ? t.ink : t.ink2 }]}>{f.label}</Text>
          </Pressable>
        ))}
      </HScroll>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-start" }}>
        {shown.map((p) => <FoodTile key={p.food.id} p={p} onPress={() => tap(p.food)} chosen={meal ? meal.includes(p.food.id) : undefined} />)}
      </View>
      {!shown.length ? <Text style={{ color: t.ink3, textAlign: "center", padding: 20 }}>{tr("No foods here.")}</Text> : null}

      <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 20 }]}>
        {tr("Foods and allergens follow the NHS's weaning advice. This is a record for you, not medical advice: ask your health visitor or GP about allergies.")}{" "}
        <Text accessibilityRole="link" onPress={() => Linking.openURL(NHS_WEANING_URL)} style={{ color: t.accentDeep, textDecorationLine: "underline" }}>{tr("NHS: weaning")}</Text>
      </Text>

      {open ? <FoodSheet child={child} food={open} onLog={() => { const f = open; setOpen(null); setTimeout(() => setLogging([f]), 250); }} onClose={() => setOpen(null)} /> : null}
      {logging ? <LogTrySheet child={child} foods={logging} onClose={() => { setLogging(null); setMeal(null); }} /> : null}
    </View>
  );
}

function Note({ icon, text }: { icon: "clock" | "refresh-cw"; text: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 10, marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: t.bg2 }}>
      <Icon name={icon} size={18} color={t.accentDeep} />
      <Text style={[TYPE.bodySmall, { color: t.ink, flex: 1 }]}>{text}</Text>
    </View>
  );
}
