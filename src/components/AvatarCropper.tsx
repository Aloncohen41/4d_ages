import React, { useEffect, useMemo, useRef } from "react";
import { Image as RNImage, PanResponder, Text, View } from "react-native";
import { Image } from "expo-image";
import Slider from "@react-native-community/slider";
import { useTheme } from "../lib/useTheme";
import { AvatarCrop } from "../lib/types";
import { MAX_ZOOM, cropLayout, defaultCrop, dragCrop, faceHigh, recenter, zoomCrop } from "../lib/crop";
import { Btn } from "./ui";
import { CropAvatar } from "./ui";

/**
 * Choose which part of a photo appears inside a round profile picture.
 * Drag the photo to move it, pinch or use the slider to zoom, and tap the buttons to recentre.
 */
export function AvatarCropper({ uri, value, onChange, size = 240 }: { uri: string; value?: AvatarCrop; onChange: (c: AvatarCrop) => void; size?: number }) {
  const t = useTheme();
  const cropRef = useRef<AvatarCrop | undefined>(value);
  cropRef.current = value;
  const last = useRef<{ x: number; y: number } | null>(null);
  const pinch = useRef<{ d: number; zoom: number } | null>(null);

  // learn the photo's shape the first time, so it's never stretched
  useEffect(() => {
    if (value) return;
    RNImage.getSize(uri, (w, h) => onChange(defaultCrop(w / h)), () => onChange(defaultCrop(1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri, !!value]);

  const apply = (next: AvatarCrop) => {
    cropRef.current = next;
    onChange(next);
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false, // keep the gesture even though the sheet scrolls
        onPanResponderGrant: () => {
          last.current = null;
          pinch.current = null;
        },
        onPanResponderMove: (e, g) => {
          const cur = cropRef.current;
          if (!cur) return;
          const touches = e.nativeEvent.touches;
          if (touches.length >= 2) {
            const d = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
            if (!pinch.current) pinch.current = { d, zoom: cur.zoom };
            else apply(zoomCrop(cur, pinch.current.zoom * (d / pinch.current.d)));
            last.current = null;
          } else {
            pinch.current = null;
            const p = { x: g.moveX, y: g.moveY };
            if (last.current) apply(dragCrop(cur, p.x - last.current.x, p.y - last.current.y, size));
            last.current = p;
          }
        },
        onPanResponderRelease: () => {
          last.current = null;
          pinch.current = null;
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size]
  );

  if (!value) {
    return <View style={{ width: size, height: size, borderRadius: 18, backgroundColor: t.bg3, alignSelf: "center" }} />;
  }
  const l = cropLayout(size, value);
  const band = size * 0.25; // the dark border that turns the square view into a round window

  return (
    <View style={{ alignItems: "center" }}>
      <View {...responder.panHandlers} style={{ width: size, height: size, borderRadius: 18, overflow: "hidden", backgroundColor: t.bg3 }}>
        <Image source={{ uri }} style={{ position: "absolute", left: l.left, top: l.top, width: l.width, height: l.height }} contentFit="fill" />
        <View pointerEvents="none" style={{ position: "absolute", left: -band, top: -band, width: size + 2 * band, height: size + 2 * band, borderRadius: (size + 2 * band) / 2, borderWidth: band, borderColor: "rgba(30,15,20,0.55)" }} />
        <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: "#ffffffcc" }} />
      </View>
      <Text style={{ color: t.ink3, fontSize: 12, marginTop: 8, textAlign: "center" }}>Drag the photo to move it · pinch or use the slider to zoom</Text>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "stretch", marginTop: 6, paddingHorizontal: 6 }}>
        <Text style={{ color: t.ink3, fontSize: 18 }}>−</Text>
        <View style={{ flex: 1 }}>
          <Slider minimumValue={1} maximumValue={MAX_ZOOM} value={value.zoom} onValueChange={(z: number) => apply(zoomCrop(cropRef.current ?? value, z))} minimumTrackTintColor={t.accent} maximumTrackTintColor={t.line} thumbTintColor={t.accent} />
        </View>
        <Text style={{ color: t.ink3, fontSize: 18 }}>＋</Text>
      </View>

      <View style={{ flexDirection: "row", gap: 8, alignSelf: "stretch", marginTop: 4 }}>
        <Btn label="⊕ Centre" kind="soft" onPress={() => apply(recenter(value))} style={{ flex: 1, paddingVertical: 10 }} />
        <Btn label="🙂 Face higher" kind="soft" onPress={() => apply(faceHigh(value))} style={{ flex: 1, paddingVertical: 10 }} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 14 }}>
        <Text style={{ color: t.ink3, fontWeight: "700", fontSize: 12 }}>How it will look</Text>
        <CropAvatar uri={uri} crop={value} size={64} ring />
        <CropAvatar uri={uri} crop={value} size={36} />
      </View>
    </View>
  );
}
