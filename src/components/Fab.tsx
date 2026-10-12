import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useActiveChild, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { EntryKind, isPet } from "../lib/types";
import { KIND_META } from "../lib/entries";
import { addPhotosFlow } from "../lib/addPhotos";
import { withAlpha } from "../lib/m3";
import { TYPE } from "../theme";
import { Icon, IconName } from "./Icon";
import { VoiceRecorderSheet } from "./Voice";

export const FAB_GAP = 16;
type Action = EntryKind | "photo" | "voice";
const ACTIONS: Action[] = ["story", "milestone", "measure", "first", "last", "voice", "photo"]; // photo / video sits nearest the button
/** A pet's: no milestones or lasts; weight, and health (it has its own tab). */
const PET_ACTIONS: Action[] = ["story", "health", "measure", "first", "voice", "photo"];
const ICON: Record<Action, IconName> = { story: "add-story", milestone: "add-milestone", measure: "add-measure", first: "add-first", last: "add-last", health: "health", photo: "add-photo", voice: "voice" };
const LABEL = (a: Action, pet = false) => (a === "photo" ? "Photo or video" : a === "voice" ? "Voice note" : pet && a === "measure" ? "Weight" : KIND_META[a].label);

/** Floating "+" in the bottom-right corner. Tap to fan out the quick-add options upward. */
export function Fab({ bottom = FAB_GAP }: { bottom?: number }) {
  const t = useTheme();
  const setEntrySheet = useStore((s) => s.setEntrySheet);
  const pet = isPet(useActiveChild());
  const actions = pet ? PET_ACTIONS : ACTIONS;
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: open ? 1 : 0, useNativeDriver: true, friction: 8, tension: 90 }).start();
  }, [open, anim]);

  const choose = (kind: Action) => {
    setOpen(false);
    if (kind === "photo") addPhotosFlow();
    else if (kind === "voice") setRecording(true); // record (or choose a file), then it becomes a story you can add words to
    else setEntrySheet({ kind });
  };

  return (
    <>
      {open ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close menu">
          <Animated.View style={{ flex: 1, backgroundColor: t.scrim, opacity: anim }} />
        </Pressable>
      ) : null}
      <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
        <View pointerEvents={open ? "auto" : "none"} style={{ alignItems: "flex-end", marginBottom: 12 }}>
          {actions.map((kind, i) => {
            const delay = (ACTIONS.length - 1 - i) / (ACTIONS.length * 1.6); // the ones nearest the button appear first
            const progress = anim.interpolate({ inputRange: [delay, Math.min(1, delay + 0.45)], outputRange: [0, 1], extrapolate: "clamp" });
            return (
              <Animated.View key={kind} style={{ opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }}>
                <Pressable onPress={() => choose(kind)} android_ripple={{ color: withAlpha(t.onChipOn, 0.14) }} style={[styles.item, { backgroundColor: t.chipOn }]} accessibilityLabel={`Add ${LABEL(kind, pet)}`}>
                  <Icon name={ICON[kind]} size={22} color={t.onChipOn} />
                  <Text style={[TYPE.labelLarge, { color: t.onChipOn }]}>{LABEL(kind, pet)}</Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
        <Pressable onPress={() => setOpen((v) => !v)} accessibilityLabel={open ? "Close menu" : "Add something"} android_ripple={{ color: withAlpha(t.onAccent, 0.2) }} style={[styles.fab, { backgroundColor: t.accent }]}>
          <Animated.View style={{ transform: [{ rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] }) }] }}><Icon name="plus" size={28} color={t.onAccent} /></Animated.View>
        </Pressable>
      </View>
      {recording ? (
        <VoiceRecorderSheet onClose={() => setRecording(false)} onDone={(item) => { setRecording(false); setTimeout(() => setEntrySheet({ kind: "story", title: "Voice note", media: [item] }), 250); }} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", right: 16, alignItems: "flex-end" },
  // Material 3 FAB: 56 dp, 16 dp corners, raised
  fab: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", overflow: "hidden", elevation: 6, shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  // the menu: tonal pills with an icon and a label
  item: { flexDirection: "row", alignItems: "center", gap: 12, height: 48, paddingHorizontal: 18, borderRadius: 24, marginBottom: 10, overflow: "hidden", elevation: 3, shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 5, shadowOffset: { width: 0, height: 1 } },
});
