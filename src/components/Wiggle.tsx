import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleProp, ViewStyle } from "react-native";

/**
 * A gentle wobble while things can be moved or removed, like app icons on a phone's home screen after a long press. Each one starts at a
 * slightly different moment (`seed`), so they don't move in step. Still when the device asks for less motion.
 */
export function Wiggle({ on, seed = 0, children, style }: { on: boolean; seed?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const a = useRef(new Animated.Value(0)).current;
  const [calm, setCalm] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setCalm).catch(() => undefined); }, []);
  useEffect(() => {
    if (!on || calm) { a.stopAnimation(); a.setValue(0); return; }
    const step = (to: number) => Animated.timing(a, { toValue: to, duration: 130, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([step(1), step(-1)]));
    const id = setTimeout(() => loop.start(), (seed * 47) % 120);
    return () => { clearTimeout(id); loop.stop(); };
  }, [on, calm, seed, a]);
  const rotate = a.interpolate({ inputRange: [-1, 1], outputRange: ["-0.6deg", "0.6deg"] });
  return <Animated.View style={[style, { transform: [{ rotate }] }]}>{children}</Animated.View>;
}
