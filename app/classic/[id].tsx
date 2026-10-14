import React, { useState } from "react";
import { openDatePicker } from "../../src/lib/datePicker";
import { Alert, Pressable, Text, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { Page } from "../../src/components/Page";
import { Btn, DateField, Input, TimeField } from "../../src/components/ui";
import { Icon } from "../../src/components/Icon";
import { useShownChild, useStore } from "../../src/lib/store";
import { useTheme } from "../../src/lib/useTheme";
import { ClassicField, TEETH, classicById, filledCount } from "../../src/lib/classics";
import { pickMedia, toMediaItems } from "../../src/lib/media";
import { addMonths, formatDate, parseISO, toISO, todayISO } from "../../src/lib/date";
import { MediaItem } from "../../src/lib/types";
import { TYPE } from "../../src/theme";

/** Pick a date with the phone's calendar. */
function pickDate(current: string | undefined, min: string, onSet: (d: string) => void) {
  openDatePicker({
    value: parseISO(current || todayISO()),
    mode: "date",
    minimumDate: parseISO(min),
    maximumDate: new Date(),
    onChange: (e, d) => { if (e.type === "set" && d) onSet(toISO(d)); },
  });
}

/**
 * One fill-in page (the birth story, teeth, food…): every field of the template, filled in any order. Save keeps it (and adds it to the book);
 * "Clear this page" empties it.
 */
export default function ClassicEditor() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const child = useShownChild();
  const tpl = classicById(String(id));
  const entry = useStore((s) => s.classics.find((c) => c.childId === child?.id && c.id === id));
  const saveClassic = useStore((s) => s.saveClassic);
  const removeClassic = useStore((s) => s.removeClassic);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v = { ...(entry?.values ?? {}) };
    // sensible starting points: the birth story is on their birthday, the first birthday a year later
    if (!entry && child && tpl?.id === "birth") v.date = child.birth;
    if (!entry && child && tpl?.id === "birthday" && addMonths(child.birth, 12) <= todayISO()) v.date = addMonths(child.birth, 12);
    return v;
  });
  const [photos, setPhotos] = useState<Record<string, MediaItem[]>>(() => ({ ...(entry?.photos ?? {}) }));
  if (!child || !tpl) return <Page title="Classics"><Text style={{ color: t.ink3, padding: 24, textAlign: "center" }}>This page isn't available.</Text></Page>;

  const set = (k: string, v: string | undefined) => setValues((cur) => {
    const next = { ...cur };
    if (v === undefined || v === "") delete next[k];
    else next[k] = v;
    return next;
  });
  const addPhotos = async (f: ClassicField) => {
    const picked = await pickMedia({ videos: false, multiple: f.kind === "photos" });
    if (!picked.length) return;
    setPhotos((cur) => ({ ...cur, [f.id]: f.kind === "photos" ? [...(cur[f.id] ?? []), ...toMediaItems(picked)] : toMediaItems(picked.slice(0, 1)) }));
  };
  const removePhoto = (field: string, mediaId: string) => setPhotos((cur) => ({ ...cur, [field]: (cur[field] ?? []).filter((x) => x.id !== mediaId) }));
  const save = () => {
    const draft = { id: tpl.id, childId: child.id, values, photos };
    if (filledCount(tpl, draft)) saveClassic(child.id, tpl.id, values, photos);
    else if (entry) removeClassic(child.id, tpl.id);
    router.back();
  };
  const clear = () =>
    Alert.alert(`Clear ${tpl.title}?`, "Everything on this page is removed, pictures included.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => { removeClassic(child.id, tpl.id); router.back(); } },
    ]);
  // a tooth or a first: tap to give it a date, tap again to change or remove it
  const dated = (key: string, label: string) => {
    if (!values[key]) return pickDate(undefined, child.birth, (d) => set(key, d));
    Alert.alert(label, formatDate(values[key]), [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => set(key, undefined) },
      { text: "Change date", onPress: () => pickDate(values[key], child.birth, (d) => set(key, d)) },
    ]);
  };

  const label = (s: string) => <Text style={[TYPE.labelLarge, { color: t.ink2, marginBottom: 6 }]}>{s}</Text>;
  const field = (f: ClassicField) => {
    switch (f.kind) {
      case "text":
        return <Input value={values[f.id] ?? ""} onChangeText={(v) => set(f.id, v)} placeholder={f.placeholder} />;
      case "long":
      case "list":
        return <Input value={values[f.id] ?? ""} onChangeText={(v) => set(f.id, v)} placeholder={f.placeholder} multiline style={{ minHeight: 96, textAlignVertical: "top" }} />;
      case "date":
        return values[f.id] ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}><DateField value={values[f.id]} min={child.birth} max={todayISO()} onChange={(d) => set(f.id, d)} /></View>
            <Pressable onPress={() => set(f.id, undefined)} accessibilityLabel={`Remove the ${f.label.toLowerCase()}`} hitSlop={8}><Icon name="x" size={20} color={t.ink3} /></Pressable>
          </View>
        ) : <Btn label="Add a date" icon="calendar" kind="line" onPress={() => pickDate(undefined, child.birth, (d) => set(f.id, d))} />;
      case "time":
        return <TimeField value={values[f.id]} onChange={(v) => set(f.id, v)} />;
      case "choice":
        return (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(f.options ?? []).map((o) => {
              const on = values[f.id] === o;
              return (
                <Pressable key={o} onPress={() => set(f.id, on ? undefined : o)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: on ? t.chipOn : t.line, backgroundColor: on ? t.chipOn : t.card }}>
                  <Text style={{ color: on ? t.onChipOn : t.ink2, fontWeight: "700" }}>{o}</Text>
                </Pressable>
              );
            })}
          </View>
        );
      case "photo":
      case "photos": {
        const list = photos[f.id] ?? [];
        const size = (width - 32 - 16) / 3;
        return (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {list.map((m) => (
              <View key={m.id} style={{ width: size, height: size, borderRadius: 12, overflow: "hidden", backgroundColor: t.bg2 }}>
                {m.uri ? <Image source={{ uri: m.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
                <Pressable onPress={() => removePhoto(f.id, m.id)} accessibilityLabel="Remove photo" hitSlop={6} style={{ position: "absolute", top: 4, right: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="x" size={16} color="#fff" />
                </Pressable>
              </View>
            ))}
            {f.kind === "photos" || !list.length ? (
              <Pressable onPress={() => addPhotos(f)} accessibilityRole="button" accessibilityLabel={`Add ${f.label.toLowerCase()}`}
                style={{ width: size, height: size, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: t.outline, alignItems: "center", justifyContent: "center", gap: 4 }}>
                <Icon name="image" size={24} color={t.ink2} />
                <Text style={[TYPE.labelMedium, { color: t.ink2 }]}>{list.length ? "Add more" : "Add photo"}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      }
      case "teeth":
        return <Mouth values={values} fieldId={f.id} onTooth={(toothId, toothLabel) => dated(`${f.id}.${toothId}`, toothLabel)} width={width - 32} />;
      case "checklist":
        return (
          <View>
            {(f.items ?? []).map((it) => {
              const key = `${f.id}.${it.id}`;
              const on = !!values[key];
              return (
                <Pressable key={it.id} onPress={() => dated(key, `First ${it.label.toLowerCase()}`)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.line }}>
                  <Icon name={on ? "check-square" : "square"} size={22} color={on ? t.accent : t.ink3} />
                  <Text style={[TYPE.bodyLarge, { color: t.ink, flex: 1 }]}>{it.label}</Text>
                  {on ? <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{formatDate(values[key])}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        );
    }
  };

  return (
    <Page title={tpl.title}>
      <Text style={[TYPE.bodyMedium, { color: t.ink3, marginBottom: 6 }]}>{tpl.desc}</Text>
      {tpl.fields.map((f) => (
        <View key={f.id} style={{ marginTop: 16 }}>
          {label(f.label)}
          {field(f)}
        </View>
      ))}
      <Btn label="Save" icon="check" onPress={save} style={{ marginTop: 24 }} />
      {entry ? <Btn label="Clear this page" icon="trash-2" kind="line" onPress={clear} style={{ marginTop: 10 }} /> : null}
    </Page>
  );
}

/** The mouth: the upper and lower baby teeth along two arches. A tooth with a date is filled in; tap one to set or change its date. */
function Mouth({ values, fieldId, onTooth, width }: { values: Record<string, string>; fieldId: string; onTooth: (id: string, label: string) => void; width: number }) {
  const t = useTheme();
  const w = Math.min(width, 360);
  const h = w * 0.9;
  const tooth = Math.round(w * 0.11);
  const place = (upper: boolean, slot: number) => {
    // ten teeth around half an ellipse: the upper arch opens downward, the lower one upward
    const a = Math.PI * (0.06 + (0.88 * slot) / 9);
    const x = w / 2 - Math.cos(a) * (w / 2 - tooth / 2 - 4);
    const y = upper ? h * 0.46 - Math.sin(a) * h * 0.38 : h * 0.54 + Math.sin(a) * h * 0.38;
    return { left: x - tooth / 2, top: y - tooth / 2 };
  };
  const done = TEETH.filter((x) => values[`${fieldId}.${x.id}`]).length;
  return (
    <View>
      <View style={{ width: w, height: h, alignSelf: "center" }}>
        <Text style={[TYPE.labelMedium, { position: "absolute", top: h * 0.4, width: w, textAlign: "center", color: t.ink3 }]}>Upper</Text>
        <Text style={[TYPE.labelMedium, { position: "absolute", top: h * 0.53, width: w, textAlign: "center", color: t.ink3 }]}>Lower</Text>
        {TEETH.map((x) => {
          const on = !!values[`${fieldId}.${x.id}`];
          const pos = place(x.upper, x.slot);
          return (
            <Pressable key={x.id} onPress={() => onTooth(x.id, x.label)} accessibilityRole="button" accessibilityLabel={`${x.label}${on ? `, came through ${formatDate(values[`${fieldId}.${x.id}`])}` : `, usually at ${x.usual}`}`}
              style={{ position: "absolute", ...pos, width: tooth, height: tooth * 1.15, borderRadius: tooth / 2.4, borderWidth: 2, borderColor: on ? t.accentDeep : t.outline, backgroundColor: on ? t.accent : t.card }} />
          );
        })}
      </View>
      <Text style={[TYPE.bodySmall, { color: t.ink3, textAlign: "center" }]}>{done} of 20 teeth</Text>
      {TEETH.filter((x) => values[`${fieldId}.${x.id}`]).sort((a, b) => values[`${fieldId}.${a.id}`].localeCompare(values[`${fieldId}.${b.id}`])).map((x) => (
        <View key={x.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: t.line }}>
          <Text style={[TYPE.bodyMedium, { color: t.ink }]}>{x.label.replace(/^./, (c) => c.toUpperCase())}</Text>
          <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{formatDate(values[`${fieldId}.${x.id}`])}</Text>
        </View>
      ))}
    </View>
  );
}
