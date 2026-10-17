import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Child, Memory } from "../lib/types";
import { VideoEvent, eventSlides } from "../lib/videoEvents";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { TYPE } from "../theme";
import { Btn, Input, Label, PhotoView, Sheet } from "./ui";
import { slideView } from "../lib/slides";
import { GrowPlayer } from "./Grow";
import { VideoExportSheet } from "./VideoExportSheet";

import { tr } from "../lib/i18n";
/**
 * A suggested video ("A Saturday to remember", "3 days in Brighton", "Maya's 2nd birthday"): give it a name and a few words if you like (they
 * go on its title card), watch it, then make it, in the Story look with music that suits it to start with.
 */
export function EventVideoSheet({ child, memories, event, onClose }: { child: Child; memories: Memory[]; event: VideoEvent; onClose: () => void }) {
  const t = useTheme();
  const key = `${child.id}:${event.id}`;
  const saved = useStore((s) => s.videoEvents[key]);
  const setVideoEvent = useStore((s) => s.setVideoEvent);
  const [title, setTitle] = useState(saved?.title ?? event.title);
  const [words, setWords] = useState(saved?.subtitle ?? "");
  const [watching, setWatching] = useState(false);
  const [making, setMaking] = useState(false);
  const slides = useMemo(() => eventSlides(memories, event), [memories, event]);
  const cover = slides.find((s) => s.uri);
  const keep = () => setVideoEvent(key, { title: title.trim() || event.title, subtitle: words.trim() || undefined });
  const subtitle = words.trim() || event.subtitle.split(" · ")[0];

  return (
    <>
      <Sheet visible={!making} onClose={() => { keep(); onClose(); }} title={tr("Made for you")}>
        {cover ? <PhotoView photo={slideView(cover)} style={{ width: "100%", aspectRatio: 1.6, borderRadius: 16 }} emojiSize={40} /> : null}
        <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 8 }]}>{event.subtitle}</Text>
        <Label>{tr("Name it")}</Label>
        <Input value={title} onChangeText={setTitle} maxLength={50} placeholder={event.title} />
        <Label>{tr("A few words (optional)")}</Label>
        <Input value={words} onChangeText={setWords} maxLength={90} placeholder={tr("Example: Our first holiday by the sea")} />
        <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 6 }]}>{tr("The name and words go on the video's title card.")}</Text>
        {watching ? <View style={{ marginTop: 14 }}><GrowPlayer slides={slides} child={child} title={title} subtitle={subtitle} fileLabel={title} /></View> : (
          <Btn label={tr("Watch it")} icon="play" kind="line" onPress={() => setWatching(true)} style={{ marginTop: 16 }} />
        )}
        <Btn label={tr("Make the video")} icon="film" onPress={() => { keep(); setMaking(true); }} style={{ marginTop: 10 }} />
        <Btn label={tr("Not now")} kind="soft" onPress={() => { setVideoEvent(key, { dismissed: true }); onClose(); }} style={{ marginTop: 10 }} />
      </Sheet>
      <VideoExportSheet visible={making} onClose={() => { setMaking(false); onClose(); }} slides={slides} child={child} initialSpeed={1} title={title.trim() || event.title} subtitle={subtitle}
        fileLabel={title.trim() || event.title} eventKind={event.kind} initialTemplate="story" />
    </>
  );
}
