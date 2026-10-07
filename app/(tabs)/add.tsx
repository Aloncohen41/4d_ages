import React, { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { Avatar, Btn, Heading, PhotoView } from "../../src/components/ui";
import { RemindersCard } from "../../src/components/RemindersCard";
import { AboutCard } from "../../src/components/AboutCard";
import { useActiveChild, useStore } from "../../src/lib/store";
import { useTheme } from "../../src/lib/useTheme";
import { pickMedia, toMemories } from "../../src/lib/media";

export default function AddTab() {
  return (
    <Screen>
      <AddPhotos />
    </Screen>
  );
}

/** Manual import only: the parent picks every photo. No scanning, no face data. */
function AddPhotos() {
  const t = useTheme();
  const active = useActiveChild();
  const kids = useStore((s) => s.kids);
  const memories = useStore((s) => s.memories);
  const addMemories = useStore((s) => s.addMemories);
  const resetAll = useStore((s) => s.resetAll);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const target = kids.find((k) => k.id === (targetId || active?.id)) || active;
  if (!target) return null;

  const recent = memories.filter((p) => p.childId === target.id && p.type === "photo" && p.media.length > 0 && p.source === "Added").slice(-8).reverse();

  const choose = async () => {
    setBusy(true);
    setMsg("");
    try {
      const picked = await pickMedia({ videos: true, multiple: true });
      if (picked.length) {
        addMemories(toMemories(target, picked));
        setMsg(`✓ ${picked.length} added to ${target.name}'s timeline. Tap ✎ on the timeline if a date looks wrong.`);
      }
    } finally {
      setBusy(false);
    }
  };

  const tips: [string, string][] = [
    ["🔎", `In the picker, search “${target.name}” — if you've named them in Google Photos, their photos come up together.`],
    ["🖐️", "Select many at once: press and hold one photo, then drag across the rest."],
    ["🔒", "Only the photos you pick are added. Nothing is scanned and no face data is created."],
  ];

  return (
    <View>
      <Heading title="Bring their moments in" desc="Choose photos and videos from your gallery or Google Photos. They're sorted onto the timeline by the date they were taken." />
      <View style={{ backgroundColor: t.card, borderRadius: 22, borderWidth: 1, borderColor: t.line, padding: 16 }}>
        <Text style={{ color: t.ink, fontWeight: "700", marginBottom: 10 }}>Whose photos are these?</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {kids.map((k) => {
            const on = k.id === target.id;
            return (
              <Pressable key={k.id} onPress={() => setTargetId(k.id)} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5, paddingLeft: 5, paddingRight: 14, borderRadius: 12, backgroundColor: on ? t.chipOn : t.card, borderWidth: 1, borderColor: on ? t.chipOn : t.line }}>
                <Avatar child={k} size={28} />
                <Text style={{ color: on ? t.onChipOn : t.ink2, fontWeight: "700" }}>{k.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={choose} disabled={busy} style={{ marginTop: 16, borderRadius: 18, borderWidth: 2, borderStyle: "dashed", borderColor: t.accent, backgroundColor: t.bg2, paddingVertical: 28, alignItems: "center", opacity: busy ? 0.6 : 1 }}>
          <Text style={{ fontSize: 30 }}>⬆️</Text>
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 16, marginTop: 4 }}>{busy ? "Adding…" : `Choose photos & videos of ${target.name}`}</Text>
          <Text style={{ color: t.ink3, fontSize: 12, marginTop: 3 }}>Opens your phone's photo picker — Google Photos included</Text>
        </Pressable>
        {msg ? <Text style={{ color: t.accentDeep, fontWeight: "700", marginTop: 10 }}>{msg}</Text> : null}
      </View>

      <View style={{ gap: 10, marginTop: 14 }}>
        {tips.map(([i, text]) => (
          <View key={text} style={{ flexDirection: "row", gap: 12, backgroundColor: t.bg2, borderRadius: 16, borderWidth: 1, borderColor: t.line, padding: 14 }}>
            <Text style={{ fontSize: 18 }}>{i}</Text>
            <Text style={{ flex: 1, color: t.ink2, lineHeight: 20, fontSize: 13 }}>{text}</Text>
          </View>
        ))}
      </View>

      {recent.length ? (
        <View style={{ marginTop: 22 }}>
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 16, marginBottom: 8 }}>Recently added</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {recent.map((p) => (
              <PhotoView key={p.id} photo={p} style={{ width: "23.5%", aspectRatio: 1, borderRadius: 12, overflow: "hidden" }} emojiSize={22} />
            ))}
          </View>
        </View>
      ) : null}

      <RemindersCard />
      <AboutCard />

      <View style={{ marginTop: 32, paddingTop: 16, borderTopWidth: 1, borderTopColor: t.line }}>
        <Text style={{ color: t.ink3, fontSize: 12, marginBottom: 8 }}>Your photos and notes live only on this phone. Export the PDF book now and then as a backup.</Text>
        <Btn
          label="Remove all children & data"
          kind="danger"
          onPress={() =>
            Alert.alert("Remove everything?", "This deletes every child, photo, milestone and measurement from this phone. It can't be undone.", [
              { text: "Cancel", style: "cancel" },
              { text: "Remove all", style: "destructive", onPress: resetAll },
            ])
          }
        />
      </View>
    </View>
  );
}
