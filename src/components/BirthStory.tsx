import React, { useState } from "react";
import { Text, View } from "react-native";
import { Child } from "../lib/types";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { BIRTH_STORY_PARTS } from "../lib/classics";
import { PREGNANCY_NAME } from "../lib/pregnancy";
import { TYPE } from "../theme";
import { Btn, Input, Sheet } from "./ui";

import { tr } from "../lib/i18n";
/** Shows the birth story for the child it was opened for (from "Welcome to the world", the profile, or Classics), over the whole app. */
export function BirthStoryHost() {
  const id = useStore((s) => s.birthStoryFor);
  const child = useStore((s) => s.kids.find((k) => k.id === id));
  const close = useStore((s) => s.setBirthStoryFor);
  if (!child) return null;
  return <BirthStorySheet child={child} onClose={() => close(undefined)} />;
}

/**
 * "Tell us everything": the whole birth story, a part at a time (how it started, getting there, labour, the birth partner, the moment they
 * arrived…). Any part can be left out. It's kept on the Birth story page in Classics, and goes into the book after the day they were born.
 */
export function BirthStorySheet({ child, onClose }: { child: Child; onClose: () => void }) {
  const t = useTheme();
  const classics = useStore((s) => s.classics);
  const saveClassic = useStore((s) => s.saveClassic);
  const celebrate = useStore((s) => s.celebrate);
  const showToast = useStore((s) => s.showToast);
  const entry = classics.find((c) => c.childId === child.id && c.id === "birth");
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(BIRTH_STORY_PARTS.map((p) => [p.id, entry?.values[p.id] ?? ""])));
  const name = child.name === PREGNANCY_NAME ? "your baby" : child.name;
  const told = BIRTH_STORY_PARTS.filter((p) => values[p.id]?.trim()).length;

  const save = () => {
    const now = useStore.getState().classics.find((c) => c.childId === child.id && c.id === "birth");
    saveClassic(child.id, "birth", { ...(now?.values ?? {}), ...values }, now?.photos ?? {});
    onClose();
    celebrate();
    showToast({ title: tr("Thank you for sharing it"), body: tr("{0} birth story is safe, and it's in the book after the day they were born.", [name === "your baby" ? "Your baby's" : `${name}'s`]) });
  };

  return (
    <Sheet visible onClose={onClose} title={tr("Tell us everything")}>
      <View style={{ backgroundColor: t.accentSoft, borderRadius: 18, padding: 16, marginBottom: 6 }}>
        <Text style={[TYPE.titleMedium, { color: t.onAccentSoft }]}>{tr("We can't wait to hear how it went! 💛")}</Text>
        <Text style={[TYPE.bodyMedium, { color: t.onAccentSoft, marginTop: 6, lineHeight: 21 }]}>
          {tr("Get comfy, make a cuppa, and tell us about the day {0} arrived, from the very first twinge. Write as much or as little as you like, skip anything, and come back to it whenever you want (it's kept on the Birth story page in Classics).", [name])}
        </Text>
      </View>
      {BIRTH_STORY_PARTS.map((p, i) => (
        <View key={p.id} style={{ marginTop: 18 }}>
          <Text style={[TYPE.titleSmall, { color: t.ink }]}>{i + 1}. {p.label}</Text>
          <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 3, marginBottom: 8, lineHeight: 18 }]}>{p.prompt}</Text>
          <Input value={values[p.id]} onChangeText={(v) => setValues((s) => ({ ...s, [p.id]: v }))} placeholder={tr("Tell us…")} multiline style={{ minHeight: 120, textAlignVertical: "top" }} />
        </View>
      ))}
      <Btn label={told ? tr("Save our birth story") : tr("Save")} icon="birthday" onPress={save} style={{ marginTop: 22 }} />
      <Text style={[TYPE.bodySmall, { color: t.ink4, textAlign: "center", marginTop: 8 }]}>{told ? tr("{0} of {1} parts told", [told, BIRTH_STORY_PARTS.length]) : tr("Every part is optional.")}</Text>
    </Sheet>
  );
}
