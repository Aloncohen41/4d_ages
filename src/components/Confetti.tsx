import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import { useStore } from "../lib/store";

const COLOURS = ["#e8798f", "#f4b740", "#7cc4a4", "#7aa7e0", "#b58ae0", "#f39a6b", "#ffffff"];
const PIECES = 90;
const LASTS_MS = 3600;

/** Confetti over the whole app, for a big moment (the baby is here, the birth story is told). Shown when `celebrate()` is called in the store. */
export function Confetti() {
  const at = useStore((s) => s.celebrateAt);
  const [shown, setShown] = useState<number | undefined>();
  useEffect(() => {
    if (!at) return;
    setShown(at);
    const timer = setTimeout(() => setShown(undefined), LASTS_MS + 400);
    return () => clearTimeout(timer);
  }, [at]);
  if (!shown) return null;
  return <Burst key={shown} />;
}

function Burst() {
  const { width, height } = Dimensions.get("window");
  const pieces = useMemo(() => Array.from({ length: PIECES }, (_, i) => ({
    x: Math.random() * width,
    drift: (Math.random() - 0.5) * 160,
    delay: Math.random() * 600,
    size: 6 + Math.random() * 8,
    round: i % 3 === 0,
    colour: COLOURS[i % COLOURS.length],
    spin: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 4),
  })), [width]);
  const fall = useRef(pieces.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.parallel(fall.map((v, i) => Animated.timing(v, { toValue: 1, duration: LASTS_MS - pieces[i].delay, delay: pieces[i].delay, easing: Easing.in(Easing.quad), useNativeDriver: true }))).start();
  }, [fall, pieces]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 200, elevation: 20 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pieces.map((p, i) => (
        <Animated.View key={i} style={{
          position: "absolute", left: p.x, top: -20, width: p.size, height: p.round ? p.size : p.size * 0.45, borderRadius: p.round ? p.size / 2 : 1.5, backgroundColor: p.colour,
          opacity: fall[i].interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateY: fall[i].interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }) },
            { translateX: fall[i].interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
            { rotate: fall[i].interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.spin * 360}deg`] }) },
          ],
        }} />
      ))}
    </View>
  );
}
