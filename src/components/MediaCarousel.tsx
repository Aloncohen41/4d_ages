import React, { useEffect, useState } from "react";
import { Image as RNImage, Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../lib/useTheme";
import { MediaItem } from "../lib/types";
import { coverOf } from "../lib/display";
import { PhotoView } from "./ui";

/**
 * Several photos / videos in one post: swipe from right to left for the next one, with dots and a "2 / 5" counter.
 * Every picture is shown whole (letterboxed, never cropped). The frame is the shape of the first (main) picture.
 */
export function MediaCarousel({ media, emoji, palette, onOpen }: { media: MediaItem[]; emoji: string; palette: string; onOpen: (index: number) => void }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const [page, setPage] = useState(0);
  const [ratio, setRatio] = useState(4 / 3);

  const main = coverOf(media);
  useEffect(() => {
    if (main?.uri) RNImage.getSize(main.uri, (iw, ih) => ih > 0 && setRatio(Math.min(1.6, Math.max(0.75, iw / ih))), () => undefined);
  }, [main?.uri]);

  const h = w / ratio;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ borderRadius: 16, overflow: "hidden", backgroundColor: t.bg3 }}>
      {w > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / w))}
          style={{ height: h }}
        >
          {media.map((m, i) => (
            <Pressable key={`${m.id}-${i}`} onPress={() => onOpen(i)} style={{ width: w, height: h }}>
              <PhotoView photo={{ media: [m], emoji, palette }} fit="contain" style={{ width: "100%", height: "100%" }} emojiSize={48} />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={{ aspectRatio: ratio }} />
      )}
      <Text style={{ position: "absolute", right: 10, top: 10, color: "#fff", backgroundColor: "#0009", fontWeight: "700", fontSize: 11, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, overflow: "hidden" }}>{page + 1} / {media.length}</Text>
      <View pointerEvents="none" style={{ position: "absolute", bottom: 8, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 5 }}>
        {media.map((m, i) => (
          <View key={`${m.id}-${i}`} style={{ width: i === page ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === page ? "#fff" : "#fff8" }} />
        ))}
      </View>
    </View>
  );
}
