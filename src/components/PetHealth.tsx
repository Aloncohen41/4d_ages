import React, { useMemo, useState } from "react";
import { Alert, Linking, Pressable, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { Btn, DateField, Heading, Input, Seg, Sheet } from "./ui";
import { Icon } from "./Icon";
import { useShownChild, uid, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { byMoment } from "../lib/display";
import { formatDate, formatTime, todayISO } from "../lib/date";
import { Child, isPet } from "../lib/types";
import { PET_HEALTH_KINDS, PET_HEALTH_NOTE } from "../lib/pets";
import { PET_DETAILS_ID, REMINDERS_ID } from "../lib/classics";
import { HealthReminder, REMINDER_IDEAS, REPEATS, Repeat, nextDates, readReminders, writeReminders } from "../lib/reminders";
import { addToCalendar, removeFromCalendar } from "../lib/calendarEvents";
import { TYPE } from "../theme";

import { tr } from "../lib/i18n";
const kindOf = (id?: string) => PET_HEALTH_KINDS.find((k) => k.id === id) ?? PET_HEALTH_KINDS[PET_HEALTH_KINDS.length - 1];

/** A pet's health, instead of development: their details (microchip, insurance, the vet), reminders, and every visit and treatment. */
export function PetCare() {
  const t = useTheme();
  const child = useShownChild();
  const memories = useStore((s) => s.memories);
  const setEntrySheet = useStore((s) => s.setEntrySheet);
  const [filter, setFilter] = useState<string>("all");
  const entries = useMemo(() => (child ? memories.filter((m) => m.childId === child.id && m.type === "health").sort((a, b) => byMoment(b, a)) : []), [memories, child]);
  if (!child || !isPet(child)) return null;
  const viewOnly = child.role === "viewer";
  const shown = filter === "all" ? entries : entries.filter((m) => m.healthKind === filter);

  return (
    <View>
      <Text style={[TYPE.bodyMedium, { color: t.ink3, marginBottom: 12 }]}>{tr("{0}'s vet visits, vaccinations and treatments, with reminders so nothing is missed.", [child.name])}</Text>
      <DetailsCard child={child} />
      <RemindersCard child={child} />

      <Text style={[TYPE.titleMedium, { color: t.ink, marginTop: 22, marginBottom: 8 }]}>{tr("Visits and treatments")}</Text>
      {!viewOnly ? <Btn label={tr("Add a health entry")} icon="plus" onPress={() => setEntrySheet({ kind: "health" })} /> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
        {[{ id: "all", label: tr("All"), emoji: "" }, ...PET_HEALTH_KINDS].map((k) => (
          <Pressable key={k.id} onPress={() => setFilter(k.id)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: filter === k.id ? t.chipOn : t.line, backgroundColor: filter === k.id ? t.chipOn : t.card }}>
            <Text style={{ color: filter === k.id ? t.onChipOn : t.ink2, fontWeight: "700", fontSize: 12 }}>{k.emoji ? `${k.emoji} ` : ""}{k.label}</Text>
          </Pressable>
        ))}
      </View>
      {shown.map((m) => (
        <Pressable key={m.id} onPress={() => !viewOnly && setEntrySheet({ kind: "health", editId: m.id })} style={{ flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.line }}>
          <Text style={{ fontSize: 22 }}>{kindOf(m.healthKind).emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[TYPE.titleSmall, { color: t.ink }]}>{m.title || kindOf(m.healthKind).label}</Text>
            <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{kindOf(m.healthKind).label} · {formatDate(m.date)}{m.location ? ` · ${m.location}` : ""}</Text>
            {m.description ? <Text style={[TYPE.bodySmall, { color: t.ink2, marginTop: 2 }]} numberOfLines={3}>{m.description}</Text> : null}
          </View>
        </Pressable>
      ))}
      {!shown.length ? <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 10 }]}>{tr("Nothing here yet. An operation can have its whole story: what happened and how they recovered.")}</Text> : null}
      <Text style={[TYPE.bodySmall, { color: t.ink4, marginTop: 16 }]}>{PET_HEALTH_NOTE}</Text>
    </View>
  );
}

/** Microchip, insurance and the vet (tap the number to call). Edited on its own page. */
function DetailsCard({ child }: { child: Child }) {
  const t = useTheme();
  const entry = useStore((s) => s.classics.find((c) => c.childId === child.id && c.id === PET_DETAILS_ID));
  const v = entry?.values ?? {};
  const rows: [string, string | undefined][] = [["Microchip", v.microchip], ["Insurance", v.insurance], ["Vet", v.vet], ["Allergies", v.allergies], ["Food and diet", v.diet]];
  const filled = rows.filter(([, x]) => x?.trim());
  return (
    <View style={{ backgroundColor: t.card, borderRadius: 20, borderWidth: 1, borderColor: t.line, padding: 16, marginTop: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={[TYPE.titleMedium, { color: t.ink, flex: 1 }]}>{tr("{0}'s details", [child.name])}</Text>
        {child.role !== "viewer" ? (
          <Pressable onPress={() => router.push({ pathname: "/classic/[id]", params: { id: PET_DETAILS_ID } })} hitSlop={8} accessibilityRole="button">
            <Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>{filled.length ? tr("Edit") : tr("Add")}</Text>
          </Pressable>
        ) : null}
      </View>
      {filled.map(([k, x]) => (
        <View key={k} style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
          <Text style={[TYPE.bodySmall, { color: t.ink3, width: 92 }]}>{k}</Text>
          <Text style={[TYPE.bodyMedium, { color: t.ink, flex: 1 }]} selectable>{x}</Text>
        </View>
      ))}
      {v.vetPhone?.trim() ? (
        <Pressable onPress={() => Linking.openURL(`tel:${v.vetPhone!.replace(/[^\d+]/g, "")}`)} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
          <Icon name="phone" size={18} color={t.accentDeep} />
          <Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>{tr("Call the vet: {0}", [v.vetPhone])}</Text>
        </Pressable>
      ) : null}
      {!filled.length && !v.vetPhone ? <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 6 }]}>{tr("Their microchip number, insurance and the vet, in one place for when you need them.")}</Text> : null}
    </View>
  );
}

/** Reminders: a vaccine booster, flea and worm treatment, the yearly check-up… as a notification, an event in the calendar, or both. */
function RemindersCard({ child }: { child: Child }) {
  const t = useTheme();
  const entry = useStore((s) => s.classics.find((c) => c.childId === child.id && c.id === REMINDERS_ID));
  const saveClassic = useStore((s) => s.saveClassic);
  const list = useMemo(() => readReminders(entry?.values), [entry]);
  const [editing, setEditing] = useState<HealthReminder | null>(null);
  const today = todayISO();
  const save = (next: HealthReminder[]) => saveClassic(child.id, REMINDERS_ID, writeReminders(next), {});
  const upcoming = [...list].map((r) => ({ r, next: nextDates(r, today, 1)[0] })).sort((a, b) => (a.next ?? "9999").localeCompare(b.next ?? "9999"));
  return (
    <View style={{ backgroundColor: t.card, borderRadius: 20, borderWidth: 1, borderColor: t.line, padding: 16, marginTop: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={[TYPE.titleMedium, { color: t.ink, flex: 1 }]}>{tr("Reminders")}</Text>
        {child.role !== "viewer" ? (
          <Pressable onPress={() => setEditing({ id: uid("rem"), title: "", kind: "vaccination", date: today, time: "09:00", repeat: "yearly", notify: true })} hitSlop={8} accessibilityRole="button">
            <Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>{tr("Add")}</Text>
          </Pressable>
        ) : null}
      </View>
      {upcoming.map(({ r, next }) => (
        <Pressable key={r.id} onPress={() => child.role !== "viewer" && setEditing(r)} style={{ flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.line }}>
          <Text style={{ fontSize: 20 }}>{kindOf(r.kind).emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[TYPE.bodyLarge, { color: t.ink }]}>{r.title}</Text>
            <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{next ? tr("Next: {0}, {1}", [formatDate(next), formatTime(r.time)]) : tr("Done")} · {REPEATS.find((x) => x.id === r.repeat)?.label}</Text>
          </View>
          {r.notify ? <Icon name="bell" size={18} color={t.ink3} /> : null}
          {r.calendar ? <Icon name="calendar" size={18} color={t.ink3} /> : null}
        </Pressable>
      ))}
      {!list.length ? <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 6 }]}>{tr("Vaccines on the dates your vet gave you, flea and worm treatments, the yearly check-up. As a notification, in your calendar, or both.")}</Text> : null}
      {editing ? (
        <ReminderSheet child={child} start={editing} isNew={!list.some((x) => x.id === editing.id)} onClose={() => setEditing(null)}
          onSave={(r) => { save(list.some((x) => x.id === r.id) ? list.map((x) => (x.id === r.id ? r : x)) : [...list, r]); setEditing(null); }}
          onDelete={(r) => { if (r.calendarEventId) removeFromCalendar(r.calendarEventId); save(list.filter((x) => x.id !== r.id)); setEditing(null); }} />
      ) : null}
    </View>
  );
}

function ReminderSheet({ child, start, isNew, onClose, onSave, onDelete }: { child: Child; start: HealthReminder; isNew: boolean; onClose: () => void; onSave: (r: HealthReminder) => void; onDelete: (r: HealthReminder) => void }) {
  const t = useTheme();
  const [r, setR] = useState<HealthReminder>(start);
  const [busy, setBusy] = useState(false);
  const [calendar, setCalendar] = useState(!!start.calendar);
  const set = (patch: Partial<HealthReminder>) => setR((cur) => ({ ...cur, ...patch }));
  const save = async () => {
    if (!r.title.trim()) return Alert.alert(tr("Give it a name"), tr("For example: Rabies booster."));
    setBusy(true);
    let next = { ...r, title: r.title.trim(), calendar };
    try {
      // the calendar event follows the reminder: made, remade after a change, or removed
      if (r.calendarEventId && (!calendar || r.date !== start.date || r.time !== start.time || r.repeat !== start.repeat || r.title !== start.title)) {
        await removeFromCalendar(r.calendarEventId);
        next = { ...next, calendarEventId: undefined };
      }
      if (calendar && !next.calendarEventId) next = { ...next, calendarEventId: await addToCalendar(next, child.name) };
    } catch (e) {
      Alert.alert(tr("Couldn't add it to the calendar"), e instanceof Error ? e.message : String(e));
      next = { ...next, calendar: false, calendarEventId: undefined };
    } finally {
      setBusy(false);
    }
    onSave(next);
  };
  return (
    <Sheet visible onClose={onClose} title={isNew ? tr("New reminder") : tr("Reminder")}>
      {isNew ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {REMINDER_IDEAS.filter((i) => child.species === "horse" || i.title !== "Farrier").map((i) => (
            <Pressable key={i.title} onPress={() => set({ title: i.title, kind: i.kind, repeat: i.repeat })} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, backgroundColor: t.accentSoft }}>
              <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12 }}>{i.title}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Input value={r.title} onChangeText={(v) => set({ title: v })} placeholder={tr("Example: Rabies booster")} />
      <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 14, marginBottom: 6 }]}>{tr("When (the date your vet gave you)")}</Text>
      <DateField value={r.date} onChange={(d) => set({ date: d })} />
      <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 14, marginBottom: 6 }]}>{tr("Time")}</Text>
      <Seg options={[{ id: "08:00", label: tr("8 am") }, { id: "09:00", label: tr("9 am") }, { id: "12:00", label: tr("Noon") }, { id: "18:00", label: tr("6 pm") }]} value={r.time} onChange={(v) => set({ time: v })} />
      <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 14, marginBottom: 6 }]}>{tr("Repeat")}</Text>
      <Seg options={REPEATS.map((x) => ({ id: x.id as Repeat, label: x.label.replace("Every ", "") }))} value={r.repeat} onChange={(v) => set({ repeat: v })} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 }}>
        <Icon name="bell" size={20} color={t.ink2} />
        <Text style={[TYPE.bodyLarge, { color: t.ink, flex: 1 }]}>{tr("Notification from 4D Ages")}</Text>
        <Switch accessibilityLabel={tr("Notification from 4D Ages")} value={r.notify} onValueChange={(v) => set({ notify: v })} trackColor={{ true: t.accent, false: t.bg3 }} thumbColor={r.notify ? t.onAccent : t.outline} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
        <Icon name="calendar" size={20} color={t.ink2} />
        <Text style={[TYPE.bodyLarge, { color: t.ink, flex: 1 }]}>{tr("Add to my calendar")}</Text>
        <Switch accessibilityLabel={tr("Add to my calendar")} value={calendar} onValueChange={setCalendar} trackColor={{ true: t.accent, false: t.bg3 }} thumbColor={calendar ? t.onAccent : t.outline} />
      </View>
      <Btn label={busy ? tr("Saving…") : tr("Save reminder")} onPress={save} disabled={busy} style={{ marginTop: 18 }} />
      {!isNew ? <Btn label={tr("Delete")} kind="line" onPress={() => onDelete(r)} style={{ marginTop: 10 }} /> : null}
    </Sheet>
  );
}
