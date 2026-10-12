import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { useTheme } from "../lib/useTheme";
import { TYPE } from "../theme";
import { MUSIC, MusicId, VIDEO_TEMPLATES, VideoTemplate, musicModule } from "../lib/videoStyles";
import { StoryWords, WhoMode } from "../lib/videoEvents";
import { formatDate } from "../lib/date";
import { Icon } from "./Icon";
import { Input, Label, Seg } from "./ui";

/** A few seconds of a track, to hear it before choosing it. */
function Listen({ id, onEnd }: { id: Exclude<MusicId, "none">; onEnd: () => void }) {
  const player = useVideoPlayer(musicModule(id), (p) => {
    p.loop = false;
    p.play();
  });
  // a short listen, then quiet
  React.useEffect(() => {
    const stop = setTimeout(() => { try { player.pause(); } catch { /* gone */ } onEnd(); }, 15_000);
    return () => clearTimeout(stop);
  }, [player, onEnd]);
  return <VideoView player={player} style={{ width: 1, height: 1, opacity: 0 }} nativeControls={false} />;
}

/**
 * The video's look and sound, and what's in it: the template, the music (each can be heard first), who's in the pictures, cards of words from
 * the stories already written (and one of your own), and whether the videos in it keep their sound.
 */
export function VideoStyleChoices({ template, onTemplate, music, onMusic, who, onWho, childName, stories, cards, onCards, ownWords, onOwnWords, hasClips, clipSound, onClipSound, disabled }: {
  template: VideoTemplate; onTemplate: (t: VideoTemplate) => void;
  music: MusicId; onMusic: (m: MusicId) => void;
  who: WhoMode; onWho: (w: WhoMode) => void; childName: string;
  stories: StoryWords[]; cards: string[]; onCards: (ids: string[]) => void;
  ownWords: string; onOwnWords: (s: string) => void;
  hasClips: boolean; clipSound: boolean; onClipSound: (on: boolean) => void;
  disabled: boolean;
}) {
  const t = useTheme();
  const [listening, setListening] = useState<MusicId | null>(null);
  const [allStories, setAllStories] = useState(false);
  const shownStories = allStories ? stories : stories.slice(0, 5);
  const toggle = (id: string) => onCards(cards.includes(id) ? cards.filter((x) => x !== id) : [...cards, id]);

  return (
    <View>
      <Label>Look</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 2 }}>
        {VIDEO_TEMPLATES.map((x) => {
          const on = x.id === template;
          return (
            <Pressable key={x.id} onPress={() => !disabled && onTemplate(x.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${x.label}: ${x.desc}`}
              style={{ width: 136, padding: 12, borderRadius: 16, borderWidth: on ? 2 : 1, borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accentSoft : t.card }}>
              <Text style={{ fontSize: 24 }}>{x.emoji}</Text>
              <Text style={[TYPE.titleSmall, { color: t.ink, marginTop: 4 }]}>{x.label}</Text>
              <Text style={[TYPE.bodySmall, { color: t.ink3 }]} numberOfLines={3}>{x.desc}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Label>Music</Label>
      <View style={{ gap: 6 }}>
        {MUSIC.map((m) => {
          const on = m.id === music;
          return (
            <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? t.accent : t.line, backgroundColor: t.card }}>
              <Pressable onPress={() => !disabled && onMusic(m.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? t.accent : t.outline, alignItems: "center", justifyContent: "center" }}>
                  {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.accent }} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[TYPE.bodyLarge, { color: t.ink }]}>{m.label}</Text>
                  <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{m.mood}</Text>
                </View>
              </Pressable>
              {m.id !== "none" ? (
                <Pressable onPress={() => setListening(listening === m.id ? null : m.id)} accessibilityLabel={listening === m.id ? `Stop ${m.label}` : `Listen to ${m.label}`} hitSlop={8}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: listening === m.id ? t.accent : t.bg2, alignItems: "center", justifyContent: "center" }}>
                  <Icon name={listening === m.id ? "pause" : "play"} size={16} color={listening === m.id ? t.onAccent : t.ink2} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
      {listening && listening !== "none" ? <Listen key={listening} id={listening} onEnd={() => setListening(null)} /> : null}
      {hasClips ? (
        <Pressable onPress={() => !disabled && onClipSound(!clipSound)} accessibilityRole="checkbox" accessibilityState={{ checked: clipSound }} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
          <Icon name={clipSound ? "check-square" : "square"} size={22} color={t.accent} />
          <Text style={[TYPE.bodyMedium, { color: t.ink, flex: 1 }]}>Keep the videos' own sound (the music goes quieter while they play)</Text>
        </Pressable>
      ) : null}

      <Label>Who's in it</Label>
      <Seg options={[{ id: "all" as WhoMode, label: "Everyone" }, { id: "alone" as WhoMode, label: `Only ${childName}` }, { id: "family" as WhoMode, label: "With family" }]} value={who} onChange={(v) => !disabled && onWho(v)} />
      <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 6 }]}>
        {who === "alone" ? `Only the posts no one else is tagged in.` : who === "family" ? "Only the posts with someone from the family tagged in them." : "Every picture."}
      </Text>

      <Label>Words</Label>
      <Input value={ownWords} onChangeText={onOwnWords} placeholder="A few words to open the video (optional)" maxLength={180} multiline />
      {stories.length ? (
        <>
          <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 10, marginBottom: 6 }]}>Add the stories you've written, each on a card at its date:</Text>
          {shownStories.map((s) => {
            const on = cards.includes(s.id);
            return (
              <Pressable key={s.id} onPress={() => !disabled && toggle(s.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                style={{ flexDirection: "row", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.line }}>
                <Icon name={on ? "check-square" : "square"} size={22} color={on ? t.accent : t.ink3} />
                <View style={{ flex: 1 }}>
                  <Text style={[TYPE.labelMedium, { color: t.ink2 }]}>{s.title || formatDate(s.date)}{s.title ? ` · ${formatDate(s.date)}` : ""}</Text>
                  <Text style={[TYPE.bodySmall, { color: t.ink3 }]} numberOfLines={2}>{s.text}</Text>
                </View>
              </Pressable>
            );
          })}
          {stories.length > 5 ? (
            <Pressable onPress={() => setAllStories((v) => !v)} style={{ paddingVertical: 8 }}>
              <Text style={{ color: t.accentDeep, fontWeight: "700" }}>{allStories ? "Show fewer" : `Show all ${stories.length} stories`}</Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 6 }]}>Stories you write show up here, to add to the video as cards of words.</Text>
      )}
    </View>
  );
}
