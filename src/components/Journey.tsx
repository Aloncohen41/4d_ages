import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, Text, View } from "react-native";
import { useTheme } from "../lib/useTheme";
import { Place } from "../lib/places";
import { journeySlides } from "../lib/journey";
import { TYPE } from "../theme";
import { Icon } from "./Icon";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WORLD = require("../../assets/world-map.png");
const ASPECT = 1600 / 631;

/** The journey in the app: the world map, a year at a time, the places of each year popping in. Plays once, and again with a tap. */
export function JourneyMap({ places, width }: { places: Place[]; width: number }) {
  const t = useTheme();
  const slides = useMemo(() => journeySlides(places), [places]);
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  const pop = useRef(new Animated.Value(0)).current;
  const height = width / ASPECT;

  useEffect(() => {
    setStep(0);
    let i = 0;
    const show = () => {
      pop.setValue(0);
      Animated.timing(pop, { toValue: 1, duration: 650, easing: Easing.out(Easing.back(2)), useNativeDriver: true }).start();
    };
    show();
    const timer = setInterval(() => {
      if (i >= slides.length - 1) return clearInterval(timer);
      i += 1;
      setStep(i);
      show();
    }, 1900);
    return () => clearInterval(timer);
  }, [slides.length, run, pop]);

  const slide = slides[Math.min(step, slides.length - 1)];
  if (!slide) return null;
  return (
    <View>
      <View style={{ width, height, borderRadius: 16, overflow: "hidden", backgroundColor: "#ECF1F3" }}>
        <Image source={WORLD} style={{ width, height }} resizeMode="stretch" />
        {slide.pins.map((p, k) => (
          <Animated.View key={`${slide.year}-${k}`} style={{
            position: "absolute", left: p.x * width - 7, top: p.y * height - 7, width: 14, height: 14, borderRadius: 7,
            backgroundColor: t.accent, borderWidth: 2, borderColor: "#fff", opacity: p.fresh ? pop : 0.55,
            transform: p.fresh ? [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }] : [],
          }} />
        ))}
        <View style={{ position: "absolute", left: 10, top: 8, backgroundColor: "#0008", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>{slide.year}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.titleSmall, { color: t.ink }]}>{slide.names}</Text>
          <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{slide.count}</Text>
        </View>
        <Pressable onPress={() => setRun((x) => x + 1)} accessibilityRole="button" accessibilityLabel="Play the journey again" hitSlop={8}
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon name="play" size={16} color={t.accentDeep} />
          <Text style={[TYPE.labelLarge, { color: t.accentDeep }]}>Play again</Text>
        </Pressable>
      </View>
    </View>
  );
}
