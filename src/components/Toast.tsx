import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Toast as ToastData, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { TYPE } from "../theme";
import { Icon, IconName } from "./Icon";

const SHOWN_MS = 5000;

/**
 * The app's own notification: a card that slides down from the top, in the app's colours, and goes away by itself (or with a tap). Used for
 * news like "Maya's book is here" instead of a system pop-up.
 */
export function Toast() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useStore((s) => s.toast);
  const showToast = useStore((s) => s.showToast);
  const [shown, setShown] = useState<ToastData | undefined>();
  const y = useRef(new Animated.Value(-160)).current;

  useEffect(() => {
    if (!toast) return;
    setShown(toast);
    y.setValue(-160);
    Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
    const timer = setTimeout(() => hide(), SHOWN_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id]);

  const hide = () => Animated.timing(y, { toValue: -160, duration: 220, useNativeDriver: true }).start(() => { setShown(undefined); showToast(null); });
  if (!shown) return null;
  const tone = shown.tone ?? "success";
  const color = tone === "error" ? t.danger : t.accent;
  const icon = (shown.icon ?? (tone === "error" ? "info" : tone === "info" ? "info" : "check")) as IconName;
  return (
    <Animated.View pointerEvents="box-none" style={{ position: "absolute", left: 12, right: 12, top: insets.top + 8, transform: [{ translateY: y }], zIndex: 100, elevation: 12 }}>
      <Pressable onPress={hide} accessibilityRole="alert" accessibilityLabel={`${shown.title}. ${shown.body ?? ""}`}
        style={{ flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: t.surfaceHigh, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: t.line, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: tone === "error" ? t.bg2 : t.accentSoft, alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={22} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.titleSmall, { color: t.ink }]}>{shown.title}</Text>
          {shown.body ? <Text style={[TYPE.bodySmall, { color: t.ink2, marginTop: 2 }]}>{shown.body}</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}
