import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Switch, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Btn, DateField, Heading, Input, Seg, Sheet } from "./ui";
import { Icon } from "./Icon";
import { OsmMap } from "./OsmMap";
import { PlacePicker } from "./PlacePicker";
import { JourneyMap } from "./Journey";
import { useShownChild, uid, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { formatDate, todayISO } from "../lib/date";
import { Child, isPet } from "../lib/types";
import { Place, placesByYear, placesSummary, readPlaces, writePlaces } from "../lib/places";
import { FoundPlace } from "../lib/geocode";
import { PET_HOME_ID, PLACES_ID, classicsFor, filledCount } from "../lib/classics";
import { createJourneyVideo, saveVideoToGallery, type VideoFormat } from "../lib/videoExport";
import { withFriendlyName } from "../lib/exportFiles";
import { onWeb } from "../lib/onWeb";
import { shareFile } from "../lib/webDownload";
import { videoFileName } from "../lib/fileNames";
import { fileExport } from "../lib/fileExport";
import { THEMES, TYPE } from "../theme";

/**
 * The places a pet has been, on a map: parks, beaches, holidays, home. Then their pack, their favourite things and the page for their kind
 * of pet, and at the bottom, the journey year by year (as a video too, and a page in their book).
 */
export function PetAdventures() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const child = useShownChild();
  const entry = useStore((s) => s.classics.find((c) => c.childId === child?.id && c.id === PLACES_ID));
  const saveClassic = useStore((s) => s.saveClassic);
  const allClassics = useStore((s) => s.classics);
  const places = useMemo(() => readPlaces(entry?.values), [entry]);
  const [editing, setEditing] = useState<Place | null>(null);
  const [video, setVideo] = useState(false);
  if (!child || !isPet(child)) return null;
  const viewOnly = child.role === "viewer";
  const save = (list: Place[]) => saveClassic(child.id, PLACES_ID, writePlaces(list), {});
  const years = placesByYear(places);
  const pages = classicsFor(child).filter((tpl) => tpl.id !== PET_HOME_ID && tpl.id !== "pet-name");
  const pins = places.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, label: p.name }));

  return (
    <View>
      <Text style={[TYPE.bodyMedium, { color: t.ink3, marginBottom: 12 }]}>{`Everywhere ${child.name} has been: the park, the beach, holidays, and home.`}</Text>
      {places.length ? (
        <>
          <Text style={[TYPE.titleSmall, { color: t.accentDeep, marginBottom: 8 }]}>{placesSummary(places)}</Text>
          <OsmMap pins={pins} height={240} />
        </>
      ) : (
        <View style={{ backgroundColor: t.bg2, borderRadius: 18, padding: 18, alignItems: "center" }}>
          <Text style={{ fontSize: 40 }}>🗺️</Text>
          <Text style={[TYPE.bodyMedium, { color: t.ink2, textAlign: "center", marginTop: 6 }]}>Add the places {child.name} has been, and watch the map fill up.</Text>
        </View>
      )}
      {!viewOnly ? <Btn label="Add a place" icon="place" onPress={() => setEditing({ id: uid("place"), name: "", lat: 0, lon: 0, date: todayISO() })} style={{ marginTop: 12 }} /> : null}

      {years.slice().reverse().map(({ year, places: list }) => (
        <View key={year} style={{ marginTop: 16 }}>
          <Text style={[TYPE.titleMedium, { color: t.ink, marginBottom: 4 }]}>{year}</Text>
          {list.slice().reverse().map((p) => (
            <Pressable key={p.id} onPress={() => !viewOnly && setEditing(p)}
              onLongPress={() => !viewOnly && Alert.alert("Remove this place?", p.name, [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => save(places.filter((x) => x.id !== p.id)) }])}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.line }}>
              <Icon name="place" size={20} color={t.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[TYPE.bodyLarge, { color: t.ink }]}>{p.name}</Text>
                <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{[p.detail, formatDate(p.date)].filter(Boolean).join(" · ")}</Text>
                {p.note ? <Text style={[TYPE.bodySmall, { color: t.ink2 }]}>{p.note}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ))}

      {/* their pack, their favourite things, and the page for their kind of pet */}
      <Text style={[TYPE.titleMedium, { color: t.ink, marginTop: 24, marginBottom: 8 }]}>About {child.name}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {pages.map((tpl) => {
          const done = filledCount(tpl, allClassics.find((c) => c.childId === child.id && c.id === tpl.id));
          return (
            <Pressable key={tpl.id} onPress={() => router.push({ pathname: "/classic/[id]", params: { id: tpl.id } })} accessibilityRole="button"
              style={{ width: "48.5%", backgroundColor: t.card, borderRadius: 18, borderWidth: 1, borderColor: t.line, padding: 14 }}>
              <Icon name={tpl.icon} size={22} color={t.accentDeep} />
              <Text style={[TYPE.titleSmall, { color: t.ink, marginTop: 6 }]}>{tpl.title}</Text>
              <Text style={[TYPE.bodySmall, { color: t.ink3 }]} numberOfLines={2}>{done ? `${done} filled in` : tpl.desc}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* the journey, year by year (with more than one place) */}
      {places.length > 1 ? (
        <View style={{ marginTop: 26 }}>
          <Text style={[TYPE.titleMedium, { color: t.ink }]}>The journey, year by year</Text>
          <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 2, marginBottom: 10 }]}>Where {child.name} has been, a year at a time. The map is in their book too.</Text>
          <JourneyMap places={places} width={width - 32} />
          <Btn label="Make it a video" icon="film" kind="soft" onPress={() => setVideo(true)} style={{ marginTop: 12 }} />
        </View>
      ) : null}

      {editing ? <PlaceSheet child={child} start={editing} isNew={!places.some((p) => p.id === editing.id)} onClose={() => setEditing(null)}
        onSave={(p) => { save(places.some((x) => x.id === p.id) ? places.map((x) => (x.id === p.id ? p : x)) : [...places, p]); setEditing(null); }} /> : null}
      {video ? <JourneyVideoSheet child={child} places={places} onClose={() => setVideo(false)} /> : null}
    </View>
  );
}

function PlaceSheet({ child, start, isNew, onClose, onSave }: { child: Child; start: Place; isNew: boolean; onClose: () => void; onSave: (p: Place) => void }) {
  const t = useTheme();
  const [where, setWhere] = useState<FoundPlace | null>(isNew ? null : { name: start.name, detail: start.detail ?? "", lat: start.lat, lon: start.lon, country: start.country, countryCode: start.countryCode });
  const [name, setName] = useState(start.name);
  const [date, setDate] = useState(start.date);
  const [note, setNote] = useState(start.note ?? "");
  const save = () => {
    if (!where) return Alert.alert("Where was it?", "Search for it, or drop a pin on the map.");
    onSave({ ...start, name: name.trim() || where.name, detail: where.detail || undefined, lat: where.lat, lon: where.lon, country: where.country, countryCode: where.countryCode, date, note: note.trim() || undefined });
  };
  return (
    <Sheet visible onClose={onClose} title={isNew ? "Add a place" : "Place"}>
      <PlacePicker value={where} onChange={(p) => { setWhere(p); if (p && !name.trim()) setName(p.name); }} />
      <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 14, marginBottom: 6 }]}>What you call it</Text>
      <Input value={name} onChangeText={setName} placeholder="Example: The big beach" />
      <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 14, marginBottom: 6 }]}>When</Text>
      <DateField value={date} onChange={setDate} min={child.birth} max={todayISO()} />
      <Input value={note} onChangeText={setNote} placeholder="A few words (optional)" multiline style={{ marginTop: 12, minHeight: 60, textAlignVertical: "top" }} />
      <Btn label="Save" onPress={save} style={{ marginTop: 16 }} />
    </Sheet>
  );
}

/** The journey as a video: square or tall, and, if wanted, an "In loving memory" ending. Then share it or save it to the phone. */
function JourneyVideoSheet({ child, places, onClose }: { child: Child; places: Place[]; onClose: () => void }) {
  const t = useTheme();
  const [format, setFormat] = useState<VideoFormat>("square");
  const [memorial, setMemorial] = useState(false);
  const [words, setWords] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const fileName = videoFileName(child.name, "Adventures");
  const make = async () => {
    setProgress(0);
    try {
      const out = await createJourneyVideo(child, places, THEMES[child.theme], format, setProgress, memorial ? (words.trim() || "Forever in our hearts") : undefined);
      setUri(await withFriendlyName(out, fileName));
    } catch (e) {
      Alert.alert("Couldn't make the video", e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  };
  return (
    <Sheet visible onClose={onClose} title="The journey as a video">
      {!uri ? (
        <>
          <Seg options={[{ id: "square" as VideoFormat, label: "Square" }, { id: "vertical" as VideoFormat, label: "Tall (stories)" }]} value={format} onChange={setFormat} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 }}>
            <Text style={[TYPE.bodyLarge, { color: t.ink, flex: 1 }]}>End with "In loving memory"</Text>
            <Switch value={memorial} onValueChange={setMemorial} trackColor={{ true: t.accent, false: t.bg3 }} thumbColor={memorial ? t.onAccent : t.outline} />
          </View>
          {memorial ? <Input value={words} onChangeText={setWords} placeholder="A few words. Example: Our best boy, forever in our hearts" multiline style={{ marginTop: 10, minHeight: 60, textAlignVertical: "top" }} /> : null}
          {progress != null ? (
            <View style={{ alignItems: "center", marginTop: 18 }}><ActivityIndicator color={t.accent} /><Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 6 }]}>Making the video… {Math.round(progress * 100)}%</Text></View>
          ) : <Btn label="Make the video" icon="film" onPress={make} style={{ marginTop: 18 }} />}
        </>
      ) : (
        <>
          <Text style={[TYPE.bodyMedium, { color: t.ink2 }]}>{child.name}'s adventures are ready.</Text>
          <Btn label="Share" icon="share" onPress={() => { if (onWeb) { shareFile(uri, /\.webm$/i.test(uri) ? fileName.replace(/\.mp4$/, ".webm") : fileName, "video/mp4"); return; } const fx = fileExport(); if (fx) fx.share(uri, "video/mp4", fileName.replace(/\.mp4$/, "")); }} style={{ marginTop: 14 }} />
          <Btn label="Save to phone" icon="download" kind="line" onPress={async () => { try { await saveVideoToGallery(uri, fileName); Alert.alert("Saved", "It's in your phone's gallery."); } catch (e) { Alert.alert("Couldn't save it", e instanceof Error ? e.message : String(e)); } }} style={{ marginTop: 10 }} />
        </>
      )}
    </Sheet>
  );
}
