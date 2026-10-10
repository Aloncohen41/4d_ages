import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { holdSwipe, releaseSwipe } from "../lib/swipeGuard";
import { GROW_SPEEDS, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { Child } from "../lib/types";
import { Image } from "expo-image";
import { Slide, slideView } from "../lib/slides";
import { ageShort, formatDate } from "../lib/date";
import { Btn, PhotoView, Seg } from "./ui";
import { VideoExportSheet } from "./VideoExportSheet";
import { Icon } from "./Icon";

const BASE_MS = 2400; // time per memory at 1×

/**
 * Crossfade between pictures with two fixed layers. The layer that is NOT showing is always invisible, so its picture
 * is swapped while nobody can see it; the fade only starts a frame after the new picture has been drawn.
 * (Before, the incoming picture could paint at full strength for a frame, vanish, then fade in — it "reappeared".)
 */
function CrossFade({ slide, fadeMs, driftMs }: { slide: Slide; fadeMs: number; driftMs: number }) {
  const [state, setState] = useState<{ layers: [Slide, Slide]; top: 0 | 1 }>({ layers: [slide, slide], top: 0 });
  const opacity = useRef([new Animated.Value(1), new Animated.Value(0)]).current;
  const scale = useRef([new Animated.Value(1), new Animated.Value(1)]).current;
  const showing = useRef<0 | 1>(0);
  const lastId = useRef(slide.id);
  const running = useRef<ReturnType<typeof Animated.parallel> | null>(null);
  const frames = useRef<number[]>([]);

  const clear = () => {
    running.current?.stop();
    frames.current.forEach((f) => cancelAnimationFrame(f));
    frames.current = [];
  };
  useEffect(() => clear, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (slide.id === lastId.current) return;
    lastId.current = slide.id;
    clear();

    const outgoing = showing.current;
    const incoming = (1 - outgoing) as 0 | 1;
    opacity[outgoing].setValue(1); // if a fade was cut short (scrubbing), finish it
    opacity[incoming].setValue(0); // the layer we are about to change is invisible
    scale[incoming].setValue(1.08);

    const f1 = requestAnimationFrame(() => {
      // a frame later: the invisible layer gets the new picture and moves to the front
      setState((cur) => {
        const layers: [Slide, Slide] = [cur.layers[0], cur.layers[1]];
        layers[incoming] = slide;
        return { layers, top: incoming };
      });
      const f2 = requestAnimationFrame(() => {
        // another frame later the picture has been drawn: now fade it in, then hide the old one
        showing.current = incoming;
        running.current = Animated.parallel([
          Animated.timing(opacity[incoming], { toValue: 1, duration: fadeMs, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(scale[incoming], { toValue: 1, duration: driftMs, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]);
        running.current.start(({ finished }) => {
          if (finished) opacity[outgoing].setValue(0);
        });
      });
      frames.current.push(f2);
    });
    frames.current.push(f1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide.id]);

  const fill = { position: "absolute" as const, left: 0, right: 0, top: 0, bottom: 0 };
  return (
    <View style={{ flex: 1 }}>
      {[0, 1].map((i) => (
        <Animated.View key={i} pointerEvents="none" style={[fill, { zIndex: state.top === i ? 2 : 1, opacity: opacity[i], transform: [{ scale: scale[i] }] }]}>
          <PhotoView fit="contain" transition={0} photo={slideView(state.layers[i])} style={{ width: "100%", height: "100%" }} emojiSize={90} />
        </Animated.View>
      ))}
    </View>
  );
}

export function GrowPlayer({ slides, child, title, subtitle, fileLabel }: { slides: Slide[]; child: Child; title?: string; subtitle?: string; fileLabel?: string }) {
  const t = useTheme();
  const speed = useStore((s) => s.growSpeed);
  const setSpeed = useStore((s) => s.setGrowSpeed);
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [exporting, setExporting] = useState(false);
  const posRef = useRef(0);

  const max = Math.max(0, slides.length - 1);
  const idx = Math.min(max, Math.floor(pos + 1e-6));
  const current = slides[idx];
  const per = BASE_MS / speed;
  const fadeMs = Math.min(1300, Math.max(250, per * 0.55));

  const seek = (v: number) => {
    posRef.current = v;
    setPos(v);
  };

  useEffect(() => { seek(0); setPlaying(false); }, [child.id]);

  // load the next pictures ahead of time so they are ready the moment they are needed
  useEffect(() => {
    slides.slice(idx + 1, idx + 4).forEach((x) => x.uri && Image.prefetch(x.uri));
  }, [idx, slides]);

  useEffect(() => {
    if (!playing) return;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const next = posRef.current + (now - last) / per;
      last = now;
      if (next >= max + 0.999) {
        if (loop) seek(0);
        else { seek(max); setPlaying(false); }
      } else seek(next);
    }, 60);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, per, max, loop]);

  if (!current) return null;

  return (
    <View>
      <View style={{ backgroundColor: t.card, borderRadius: 26, padding: 10, paddingBottom: 18, borderWidth: 1, borderColor: t.line }}>
        <View style={{ aspectRatio: 4 / 3, borderRadius: 18, overflow: "hidden", backgroundColor: t.bg3 }}>
          <CrossFade slide={current} fadeMs={fadeMs} driftMs={per * 1.6} />
          <View style={{ position: "absolute", bottom: 10, alignSelf: "center", backgroundColor: "#2c1f15d0", borderRadius: 99, paddingHorizontal: 16, paddingVertical: 6 }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>{ageShort(child.birth, current.date)}</Text>
          </View>
        </View>
        <View style={{ alignItems: "center", paddingTop: 12, minHeight: 74 }}>
          <Text style={{ color: t.ink4, fontWeight: "700", fontSize: 12 }}>{formatDate(current.date)}</Text>
          <Text style={{ color: t.ink2, textAlign: "center", marginTop: 4, lineHeight: 20 }}>{current.caption}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 }}>
        <Pressable
          onPress={() => { if (!playing && posRef.current >= max) seek(0); setPlaying(!playing); }}
          style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name={playing ? "pause" : "play"} size={26} color={t.onAccent} />
        </Pressable>
        <View style={{ flex: 1 }} onTouchStart={holdSwipe} onTouchEnd={releaseSwipe} onTouchCancel={releaseSwipe}>
          {max > 0 ? (
            <Slider
              minimumValue={0}
              maximumValue={max}
              value={Math.min(pos, max)}
              onValueChange={(v: number) => { setPlaying(false); seek(v); }}
              minimumTrackTintColor={t.accent}
              maximumTrackTintColor={t.line}
              thumbTintColor={t.accent}
            />
          ) : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: t.ink4, fontSize: 11, fontWeight: "700" }}>{formatDate(slides[0].date)}</Text>
            <Text style={{ color: t.ink4, fontSize: 11, fontWeight: "700" }}>{idx + 1} of {slides.length}</Text>
            <Text style={{ color: t.ink4, fontSize: 11, fontWeight: "700" }}>{formatDate(slides[slides.length - 1].date)}</Text>
          </View>
        </View>
      </View>

      <View style={{ marginTop: 16, alignItems: "center", gap: 10 }}>
        <Text style={{ color: t.ink2, fontWeight: "700", fontSize: 12 }}>Speed · {(per / 1000).toFixed(1)}s per photo</Text>
        <View style={{ alignSelf: "stretch" }}>
          <Seg options={GROW_SPEEDS.map((v) => ({ id: v, label: `${v}×` }))} value={speed} onChange={setSpeed} />
        </View>
        <Pressable onPress={() => setLoop((l) => !l)} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: loop ? t.accent : t.line, backgroundColor: loop ? t.accentSoft : t.card }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Icon name="loop" size={14} color={loop ? t.accentDeep : t.ink3} /><Text style={{ color: loop ? t.accentDeep : t.ink3, fontWeight: "700", fontSize: 12 }}>Loop</Text></View>
        </Pressable>
        <Btn label="Save as video" icon="film" onPress={() => { setPlaying(false); setExporting(true); }} style={{ alignSelf: "stretch", marginTop: 4 }} />
      </View>
      <VideoExportSheet visible={exporting} onClose={() => setExporting(false)} slides={slides} child={child} initialSpeed={speed} title={title} subtitle={subtitle} fileLabel={fileLabel} />
    </View>
  );
}
