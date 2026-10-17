import React, { useMemo, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { withAlpha } from "../lib/m3";
import { Child, FoodTry } from "../lib/types";
import { Amount, Food, FoodProgress, Liked, NHS_ALLERGY_URL, Reaction, TRIES_TO_DONE, allergenProgress, foodById, foodProgress, suggestions } from "../lib/foods";
import { daysBetween, formatDate, todayISO } from "../lib/date";
import { TYPE } from "../theme";
import { Btn, DateField, Input, Label, Seg, Sheet } from "./ui";
import { Icon } from "./Icon";

import { tr } from "../lib/i18n";
/*
 * First foods, the pieces: the card on the Growth tab, a food's tile (its tries as three dots), and the sheets for logging a try (one food,
 * or a whole meal at once) and for one food's history. See app/foods.tsx for the page and src/lib/foods.ts for the list and the rules.
 */

/** Whether First foods is for this child now: from about 4 months to 3 years, or whenever they already have tries. */
export function foodsShown(child: Child, tries: FoodTry[]): boolean {
  if (child.expecting || child.kind === "pet") return false;
  const months = daysBetween(child.birth, todayISO()) / 30.4375;
  return (months >= 4 && months <= 36) || tries.some((x) => x.childId === child.id);
}

const STATUS_WORDS = { new: "Not tried", trying: "Trying", done: "Done", reaction: "Reaction" } as const;

/** The colour for where a food stands: grey not tried, the theme while trying, green done, red a reaction. */
export function statusColour(t: ReturnType<typeof useTheme>, s: FoodProgress["status"]) {
  return s === "done" ? "#2e7d4f" : s === "reaction" ? t.danger : s === "trying" ? t.accent : t.outline;
}

/** The tries as dots: filled for each try so far, out of three. */
export function TryDots({ p }: { p: FoodProgress }) {
  const t = useTheme();
  const c = statusColour(t, p.status);
  return (
    <View style={{ flexDirection: "row", gap: 4 }} accessible accessibilityLabel={tr("{0} of {1} tries", [Math.min(p.tries, TRIES_TO_DONE), TRIES_TO_DONE])}>
      {Array.from({ length: TRIES_TO_DONE }, (_, i) => (
        <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i < p.tries ? c : "transparent", borderWidth: 1.5, borderColor: i < p.tries ? c : t.outline }} />
      ))}
    </View>
  );
}

/** A food's tile: its picture, name and tries; ticked or marked when done or reacted to. In a meal, a tap chooses it instead. */
export function FoodTile({ p, onPress, chosen }: { p: FoodProgress; onPress: () => void; chosen?: boolean }) {
  const t = useTheme();
  const c = statusColour(t, p.status);
  return (
    <Pressable onPress={onPress} accessibilityRole={chosen === undefined ? "button" : "checkbox"} aria-checked={chosen} accessibilityLabel={`${p.food.name}. ${STATUS_WORDS[p.status]}${p.tries ? `, ${p.tries} ${p.tries === 1 ? "try" : "tries"}` : ""}`}
      style={{ width: 104, alignItems: "center", paddingVertical: 10, paddingHorizontal: 6, borderRadius: 16, backgroundColor: chosen ? withAlpha(t.accent, 0.14) : t.card, borderWidth: chosen ? 2 : 1, borderColor: chosen ? t.accent : p.status === "new" ? t.line : withAlpha(c, 0.6) }}>
      <Text style={{ fontSize: 30 }}>{p.food.emoji}</Text>
      <Text style={[TYPE.labelMedium, { color: t.ink, textAlign: "center", marginTop: 4, minHeight: 32 }]} numberOfLines={2}>{p.food.name}</Text>
      <View style={{ marginTop: 4 }}><TryDots p={p} /></View>
      {p.status === "done" ? <View style={{ position: "absolute", top: 6, right: 6 }}><Icon name="check" size={16} color={c} /></View> : null}
      {p.status === "reaction" ? <View style={{ position: "absolute", top: 6, right: 6 }}><Icon name="alert-triangle" size={16} color={c} /></View> : null}
      {p.food.allergen ? <View style={{ position: "absolute", top: 6, left: 6, paddingHorizontal: 5, borderRadius: 6, backgroundColor: t.bg2 }}><Text style={{ fontSize: 9, fontWeight: "700", color: t.ink2 }}>{tr("ALLERGEN")}</Text></View> : null}
    </Pressable>
  );
}

/** The card on the Growth tab: how far along they are, and what to try next. Opens the First foods page. */
export function FirstFoodsCard({ child }: { child: Child }) {
  const t = useTheme();
  const tries = useStore((s) => s.foodTries);
  const progress = useMemo(() => foodProgress(tries, child.id), [tries, child.id]);
  if (!foodsShown(child, tries)) return null;
  const all = [...progress.values()];
  const tried = all.filter((p) => p.tries).length;
  const allergens = allergenProgress(progress);
  const next = suggestions(progress, daysBetween(child.birth, todayISO()) / 30.4375, 2);
  const reactions = all.filter((p) => p.status === "reaction").length;
  return (
    <Pressable onPress={() => router.push("/foods")} accessibilityRole="link" style={{ marginTop: 16, backgroundColor: t.card, borderRadius: 22, borderWidth: 1, borderColor: t.line, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ fontSize: 26 }}>🥄</Text>
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.titleMedium, { color: t.ink }]}>{tr("First foods")}</Text>
          <Text style={[TYPE.bodySmall, { color: t.ink2 }]}>{tr("{0} foods tried · {1} of {2} allergens done{3}", [tried, allergens.filter((a) => a.status === "done").length, allergens.length, reactions ? ` · ${reactions} reaction${reactions === 1 ? "" : "s"}` : ""])}</Text>
        </View>
        <Icon name="chevron-right" size={22} color={t.ink3} />
      </View>
      {next.length ? <Text style={[TYPE.bodySmall, { color: t.accentDeep, marginTop: 8, fontWeight: "700" }]}>{tr("Try next: {0}", [next.map((f) => `${f.emoji} ${f.name}`).join(", ")])}</Text> : null}
    </Pressable>
  );
}

const AMOUNTS: { id: Amount; label: string }[] = [{ id: "taste", get label() { return tr("A taste"); } }, { id: "some", get label() { return tr("Some"); } }, { id: "portion", get label() { return tr("A portion"); } }];
const LIKED: { id: Liked; label: string }[] = [{ id: "yes", get label() { return tr("😋 Liked it"); } }, { id: "meh", get label() { return tr("😐 Not sure"); } }, { id: "no", get label() { return tr("😖 Didn't"); } }];
const REACTIONS: { id: Reaction; label: string }[] = [{ id: "none", get label() { return tr("None"); } }, { id: "mild", get label() { return tr("Mild"); } }, { id: "serious", get label() { return tr("Serious"); } }];

/**
 * Logging a try: one food, or several eaten together (a meal). When, how much, how they liked it, and any reaction (what it was, for the
 * doctor). A serious reaction says plainly to get help now. The first taste of a food can also become a post.
 */
export function LogTrySheet({ child, foods, onClose }: { child: Child; foods: Food[]; onClose: () => void }) {
  const t = useTheme();
  const addFoodTries = useStore((s) => s.addFoodTries);
  const setEntrySheet = useStore((s) => s.setEntrySheet);
  const tries = useStore((s) => s.foodTries);
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState<Amount>("taste");
  const [liked, setLiked] = useState<Liked>("yes");
  const [reaction, setReaction] = useState<Reaction>("none");
  const [note, setNote] = useState("");
  const [post, setPost] = useState(false);
  const firstTaste = foods.length === 1 && !tries.some((x) => x.childId === child.id && x.food === foods[0].id);
  const names = foods.map((f) => f.name).join(", ");
  const save = () => {
    addFoodTries(foods.map((f) => ({ childId: child.id, food: f.id, date, amount, liked, reaction, ...(reaction !== "none" && note.trim() ? { note: note.trim() } : {}) })));
    onClose();
    if (post && firstTaste) setTimeout(() => setEntrySheet({ kind: "first", title: tr("First taste: {0}", [foods[0].name]) }), 250);
  };
  return (
    <Sheet visible onClose={onClose} title={foods.length === 1 ? `${foods[0].emoji} ${foods[0].name}` : tr("A meal: {0} foods", [foods.length])}>
      {foods.length > 1 ? <Text style={[TYPE.bodySmall, { color: t.ink2, marginBottom: 6 }]}>{names}</Text> : null}
      {foods.length === 1 && foods[0].prep ? <Text style={[TYPE.bodySmall, { color: t.ink2, marginBottom: 6 }]}>{foods[0].prep}</Text> : null}
      <Label>{tr("When")}</Label>
      <DateField value={date} onChange={setDate} min={child.birth} max={todayISO()} />
      <Label>{tr("How much")}</Label>
      <Seg options={AMOUNTS} value={amount} onChange={setAmount} />
      <Label>{tr("How did they like it?")}</Label>
      <Seg options={LIKED} value={liked} onChange={setLiked} />
      <Label>{tr("Any reaction?")}</Label>
      <Seg options={REACTIONS} value={reaction} onChange={setReaction} />
      {reaction !== "none" ? (
        <>
          <Input value={note} onChangeText={setNote} placeholder={tr("What happened, and how soon after? Example: red rash round the mouth after 10 minutes")} multiline style={{ marginTop: 10, minHeight: 70 }} />
          {reaction === "serious" ? (
            <View style={{ marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: withAlpha(t.danger, 0.1), borderWidth: 1, borderColor: withAlpha(t.danger, 0.4) }}>
              <Text style={[TYPE.titleSmall, { color: t.danger }]}>{tr("If it's happening now")}</Text>
              <Text style={[TYPE.bodySmall, { color: t.ink, marginTop: 4 }]}>{tr("Call 999 if your baby has swelling of the lips, mouth or throat, trouble breathing, or goes floppy or pale. For anything else, ask your GP or call 111.")}</Text>
              <Text accessibilityRole="link" onPress={() => Linking.openURL(NHS_ALLERGY_URL)} style={[TYPE.bodySmall, { color: t.accentDeep, textDecorationLine: "underline", marginTop: 6 }]}>{tr("NHS: food allergies in babies")}</Text>
            </View>
          ) : null}
        </>
      ) : null}
      {firstTaste ? (
        <Pressable onPress={() => setPost((v) => !v)} accessibilityRole="checkbox" aria-checked={post} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 }}>
          <Icon name={post ? "check-square" : "square"} size={22} color={post ? t.accent : t.ink3} />
          <Text style={[TYPE.bodyMedium, { color: t.ink2, flex: 1 }]}>{tr("Also make it a post (\"First taste: {0}\"), to add a photo", [foods[0].name])}</Text>
        </Pressable>
      ) : null}
      <Btn label={foods.length === 1 ? tr("Save the try") : tr("Save {0} tries", [foods.length])} onPress={save} style={{ marginTop: 16 }} />
    </Sheet>
  );
}

/** One food: how to give it, every try so far (each can be removed), and a button to log another. */
export function FoodSheet({ child, food, onLog, onClose }: { child: Child; food: Food; onLog: () => void; onClose: () => void }) {
  const t = useTheme();
  const tries = useStore((s) => s.foodTries);
  const removeFoodTry = useStore((s) => s.removeFoodTry);
  const mine = tries.filter((x) => x.childId === child.id && x.food === food.id).sort((a, b) => b.date.localeCompare(a.date));
  const p = foodProgress(tries, child.id).get(food.id)!;
  const too = food.from && daysBetween(child.birth, todayISO()) / 30.4375 < food.from;
  return (
    <Sheet visible onClose={onClose} title={`${food.emoji} ${food.name}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <TryDots p={p} />
        <Text style={[TYPE.labelLarge, { color: statusColour(t, p.status) }]}>{STATUS_WORDS[p.status]}{p.status === "trying" ? tr(" · {0} more to go", [TRIES_TO_DONE - p.tries]) : ""}</Text>
      </View>
      {food.prep ? <Text style={[TYPE.bodyMedium, { color: t.ink2, marginTop: 10 }]}>{food.prep}</Text> : null}
      {too ? <Text style={[TYPE.bodyMedium, { color: t.danger, marginTop: 8, fontWeight: "700" }]}>{tr("Not yet: from {0} months.", [food.from])}</Text> : null}
      {food.allergen ? <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 8 }]}>{tr("An allergen. Give it at home, earlier in the day, one new allergen at a time, so you can see how they get on.")}</Text> : null}
      <Btn label={tr("Log a try")} icon="plus" onPress={onLog} disabled={!!too} style={{ marginTop: 14 }} />
      {mine.length ? <Label>{tr("Tries")}</Label> : null}
      {mine.map((x) => (
        <View key={x.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.line }}>
          <View style={{ flex: 1 }}>
            <Text style={[TYPE.bodyMedium, { color: t.ink }]}>{formatDate(x.date)} · {AMOUNTS.find((a) => a.id === x.amount)?.label ?? ""}{x.liked ? ` · ${LIKED.find((l) => l.id === x.liked)?.label}` : ""}</Text>
            {x.reaction && x.reaction !== "none" ? <Text style={[TYPE.bodySmall, { color: t.danger, fontWeight: "700" }]}>{x.reaction === "serious" ? tr("Serious reaction") : tr("Mild reaction")}{x.note ? `: ${x.note}` : ""}</Text> : null}
          </View>
          <Pressable onPress={() => removeFoodTry(x.id)} accessibilityRole="button" accessibilityLabel={tr("Remove the try on {0}", [formatDate(x.date)])} hitSlop={6}><Icon name="trash-2" size={18} color={t.ink3} /></Pressable>
        </View>
      ))}
    </Sheet>
  );
}

export { foodById };
