import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useWebToast } from "../lib/toast.web";

/** A message at the bottom of the page, like the phone's toast, for 2.5 seconds (5 for a long one). */
export function WebToast() {
  const { message, at, long } = useWebToast();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!at) return;
    setShown(true);
    const t = setTimeout(() => setShown(false), long ? 5000 : 2500);
    return () => clearTimeout(t);
  }, [at, long]);
  if (!shown || !message) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 96, alignItems: "center", zIndex: 300, paddingHorizontal: 20 }} accessibilityLiveRegion="polite">
      <View style={{ backgroundColor: "#323232ee", borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10, maxWidth: 520 }}>
        <Text style={{ color: "#fff", fontSize: 14, textAlign: "center" }}>{message}</Text>
      </View>
    </View>
  );
}
