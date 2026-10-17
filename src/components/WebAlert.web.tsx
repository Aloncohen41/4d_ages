import React from "react";
import { Alert, AlertButton, Modal, Pressable, Text, View } from "react-native";
import { create } from "zustand";
import { useTheme } from "../lib/useTheme";
import { withAlpha } from "../lib/m3";
import { TYPE } from "../theme";
import { dialogName } from "./ui";

import { tr } from "../lib/i18n";
/*
 * On the website, Alert.alert did nothing at all (the website's library leaves it empty), so every "Delete this post?" and every
 * other question asked that way never appeared, and nothing it guarded could be done. Here it opens a dialog in the page instead,
 * with the same title, message and buttons.
 */
interface Asked { title: string; message?: string; buttons: AlertButton[] }
const useAsked = create<{ queue: Asked[] }>(() => ({ queue: [] }));

Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
  useAsked.setState((s) => ({ queue: [...s.queue, { title, message, buttons: buttons?.length ? buttons : [{ text: tr("OK") }] }] }));
};

export function WebAlert() {
  const t = useTheme();
  const asked = useAsked((s) => s.queue[0]);
  if (!asked) return null;
  const answer = (b?: AlertButton) => {
    useAsked.setState((s) => ({ queue: s.queue.slice(1) }));
    b?.onPress?.();
  };
  const cancel = asked.buttons.find((b) => b.style === "cancel");
  // the cancel button first (on the left), the rest after it, as on the phone
  const buttons = [...asked.buttons].sort((a, b) => (a.style === "cancel" ? -1 : 0) - (b.style === "cancel" ? -1 : 0));
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => answer(cancel)} {...dialogName(asked.title)}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: t.scrim }}>
        <View role="alertdialog" style={{ width: "100%", maxWidth: 420, borderRadius: 28, padding: 24, backgroundColor: t.surfaceHigh, boxShadow: "0 24px 64px rgba(0,0,0,.25)" } as object}>
          <Text role="heading" aria-level={2} style={[TYPE.headlineSmall, { color: t.ink }]}>{asked.title}</Text>
          {asked.message ? <Text style={[TYPE.bodyMedium, { color: t.ink2, marginTop: 12 }]}>{asked.message}</Text> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
            {buttons.map((b, i) => (
              <Pressable key={i} onPress={() => answer(b)} accessibilityRole="button" style={(s) => ({ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: (s as { hovered?: boolean }).hovered ? withAlpha(t.ink, 0.07) : "transparent" })}>
                <Text style={[TYPE.labelLarge, { color: b.style === "destructive" ? t.danger : t.accentDeep, fontSize: 15 }]}>{b.text ?? "OK"}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
