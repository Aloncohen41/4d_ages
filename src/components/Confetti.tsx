import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Dimensions, Easing, StyleSheet, Text, View } from "react-native";
import { useStore } from "../lib/store";
import { CONFETTI_MS, Piece, burst } from "../lib/confetti";
import { TYPE } from "../theme";

/**
 * Confetti over the whole app, for a big moment: the baby is here, the birth story is told, a birthday, a milestone or a first. Shown when
 * `celebrate()` is called in the store, with its words (if any) in the middle as the burst opens.
 */
export function Confetti() {
  const at = useStore((s) => s.celebrateAt);
  const text = useStore((s) => s.celebrateText);
  const [shown, setShown] = useState<number | undefined>();
  useEffect(() => {
    if (!at) return;
    setShown(at);
    const timer = setTimeout(() => setShown(undefined), CONFETTI_MS + 300);
    return () => clearTimeout(timer);
  }, [at]);
  const [calm, setCalm] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setCalm).catch(() => undefined); }, []);
  if (!shown) return null;
  return <Burst key={shown} text={text} calm={calm} />;
}

function Burst({ text, calm }: { text?: string; calm: boolean }) {
  const { width, height } = Dimensions.get("window");
  const pieces = useMemo(() => (calm ? [] : burst(width, height)), [width, height, calm]); // less motion asked for: only the words
  const clock = useRef(new Animated.Value(0)).current; // one clock for every piece, on the animation thread
  useEffect(() => {
    Animated.timing(clock, { toValue: 1, duration: CONFETTI_MS, easing: Easing.linear, useNativeDriver: true }).start();
  }, [clock]);
  const cx = width / 2, cy = height * 0.48;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 200, elevation: 20 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {text ? <Message text={text} clock={clock} /> : null}
      {pieces.map((p, i) => <Bit key={i} p={p} clock={clock} cx={cx} cy={cy} />)}
    </View>
  );
}

/** One piece: its flight, its spin, turning over (the back a shade darker), and fading at the very end. */
const Bit = React.memo(function Bit({ p, clock, cx, cy }: { p: Piece; clock: Animated.Value; cx: number; cy: number }) {
  const start = p.delay / CONFETTI_MS;
  const inputRange = [0, ...p.times.map((t) => start + t * (1 - start) + (t === 0 ? 0.000001 : 0))];
  const at = (values: number[]) => [values[0], ...values];
  const tx = clock.interpolate({ inputRange, outputRange: at(p.x) });
  const ty = clock.interpolate({ inputRange, outputRange: at(p.y) });
  const spin = clock.interpolate({ inputRange, outputRange: at(p.spin).map((d) => `${d}deg`) });
  const flip = clock.interpolate({ inputRange, outputRange: at(p.flip) });
  const shade = clock.interpolate({ inputRange, outputRange: at(p.flip.map((f) => (f < 0 ? 0.28 * -f : 0))) });
  const opacity = clock.interpolate({ inputRange: [0, start, start + 0.0001, 0.86, 1], outputRange: [0, 0, 1, 1, 0] });
  const radius = p.shape === "circle" ? p.w / 2 : p.shape === "streamer" ? p.w / 2 : 1.5;
  return (
    <Animated.View style={{
      position: "absolute", left: cx - p.w / 2, top: cy - p.h / 2, width: p.w, height: p.h, borderRadius: radius, backgroundColor: p.colour, overflow: "hidden", opacity,
      transform: [{ translateX: tx }, { translateY: ty }, { rotate: spin }, p.shape === "streamer" ? { scaleX: flip } : { scaleY: flip }],
    }}>
      <Animated.View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "#000", opacity: shade }} />
    </Animated.View>
  );
});

/** The words, popping up in the middle as the confetti bursts out from behind them. */
function Message({ text, clock }: { text: string; clock: Animated.Value }) {
  const scale = clock.interpolate({ inputRange: [0, 0.05, 0.09, 0.8, 0.9], outputRange: [0.4, 1.12, 1, 1, 0.96], extrapolate: "clamp" });
  const opacity = clock.interpolate({ inputRange: [0, 0.04, 0.78, 0.9], outputRange: [0, 1, 1, 0], extrapolate: "clamp" });
  return (
    <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }]}>
      <Animated.View style={{ opacity, transform: [{ scale }], backgroundColor: "#ffffffee", borderRadius: 24, paddingHorizontal: 22, paddingVertical: 16, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 18, elevation: 8 }}>
        <Text style={[TYPE.headlineSmall, { color: "#3d2630", textAlign: "center" }]}>{text}</Text>
      </Animated.View>
    </View>
  );
}
