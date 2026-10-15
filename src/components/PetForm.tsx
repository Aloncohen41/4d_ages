import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { uid, useStore } from "../lib/store";
import { useTheme } from "../lib/useTheme";
import { addMonths, todayISO } from "../lib/date";
import { DogSize, ORIGINS, PetOrigin, SPECIES, Species, speciesInfo } from "../lib/pets";
import { PET_HOME_ID } from "../lib/classics";
import { FoundPlace } from "../lib/geocode";
import { pickMedia, toMediaItems, toMemories, Picked } from "../lib/media";
import { AvatarCrop, Gender, KidTheme } from "../lib/types";
import { THEMES, THEME_ORDER, TYPE } from "../theme";
import { Btn, DateField, Input, Label, PhotoView, Seg, ThemePicker } from "./ui";
import { AvatarCropper } from "./AvatarCropper";
import { PlacePicker } from "./PlacePicker";

/**
 * Adding a pet: their name and photo, what kind of pet and the breed, boy or girl, the birthday (or a guess), the day they came home, and
 * where they came from (who, the place, photos of the day, and the place on the map). Saved as their own book, with the "Coming home" page
 * filled in.
 */
export function AddPetForm({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const addChild = useStore((s) => s.addChild);
  const updateChild = useStore((s) => s.updateChild);
  const addMemories = useStore((s) => s.addMemories);
  const saveClassic = useStore((s) => s.saveClassic);
  const today = todayISO();
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species>("dog");
  const [breed, setBreed] = useState("");
  const [dogSize, setDogSize] = useState<DogSize>("medium");
  const [gender, setGender] = useState<Gender>("unspecified");
  const [birth, setBirth] = useState(addMonths(today, -12));
  const [approx, setApprox] = useState(false);
  const [gotcha, setGotcha] = useState(today);
  const [theme, setTheme] = useState<KidTheme>("green");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [crop, setCrop] = useState<AvatarCrop | undefined>();
  const [origin, setOrigin] = useState<PetOrigin | null>(null);
  const [placeName, setPlaceName] = useState("");
  const [where, setWhere] = useState<FoundPlace | null>(null);
  const [dayPhotos, setDayPhotos] = useState<Picked[]>([]);
  const [showWhere, setShowWhere] = useState(false);
  const [err, setErr] = useState("");
  const info = speciesInfo(species);
  const breedIdeas = info.breeds.filter((b) => !breed.trim() || b.toLowerCase().includes(breed.trim().toLowerCase())).slice(0, 8);

  const choosePhoto = async () => {
    const picked = await pickMedia({ videos: false, multiple: false });
    if (picked.length) { setPhotoUri(picked[0].uri); setCrop(undefined); }
  };
  const chooseDayPhotos = async () => {
    const picked = await pickMedia({ videos: false, multiple: true });
    if (picked.length) setDayPhotos((cur) => [...cur, ...picked]);
  };

  const create = () => {
    if (!name.trim()) return setErr("What's their name?");
    if (birth > today) return setErr("The birthday can't be in the future.");
    if (gotcha > today) return setErr("The day they came home can't be in the future.");
    const pet = {
      id: uid("pet"), name: name.trim(), birth, theme, emoji: info.emoji, gender, kind: "pet" as const, species, ...(breed.trim() ? { breed: breed.trim() } : {}),
      ...(species === "dog" ? { dogSize } : {}), ...(approx ? { birthApprox: true } : {}), gotchaDay: gotcha < birth ? birth : gotcha,
    };
    addChild(pet);
    if (photoUri) {
      const [p] = toMemories(pet, [{ uri: photoUri, kind: "photo", date: pet.gotchaDay }], "Profile");
      addMemories([p]);
      updateChild(pet.id, { avatarPhotoId: p.id, avatarCrop: crop });
    }
    // the Coming home page: the day, who from, the place (and its point on the map), and the photos of that day
    const fromLabel = origin ? ORIGINS.find((o) => o.id === origin)?.label ?? "" : "";
    const values: Record<string, string> = { date: pet.gotchaDay };
    if (fromLabel) values.from = fromLabel;
    if (placeName.trim() || where?.name) values.place = placeName.trim() || where!.name;
    if (where) Object.assign(values, { address: [where.name, where.detail].filter(Boolean).join(", "), lat: String(where.lat), lon: String(where.lon) });
    saveClassic(pet.id, PET_HOME_ID, values, dayPhotos.length ? { photos: toMediaItems(dayPhotos) } : {});
    onDone();
  };

  const chip = (on: boolean) => ({ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: on ? t.chipOn : t.line, backgroundColor: on ? t.chipOn : t.card } as const);
  return (
    <View>
      <Label>Name</Label>
      <Input value={name} onChangeText={setName} placeholder="Example: Rex" />

      <Label>What kind of pet</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {SPECIES.map((s) => (
          <Pressable key={s.id} onPress={() => { setSpecies(s.id); setBreed(""); }} accessibilityRole="radio" aria-checked={species === s.id} style={chip(species === s.id)}>
            <Text style={{ color: species === s.id ? t.onChipOn : t.ink2, fontWeight: "700" }}>{s.emoji} {s.label}</Text>
          </Pressable>
        ))}
      </View>

      <Label>Breed (optional)</Label>
      <Input value={breed} onChangeText={setBreed} placeholder={`Example: ${info.breeds[1] ?? info.breeds[0]}`} />
      {breedIdeas.length && !info.breeds.includes(breed) ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {breedIdeas.map((b) => (
            <Pressable key={b} onPress={() => setBreed(b)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: t.accentSoft }}>
              <Text style={{ color: t.accentDeep, fontWeight: "700", fontSize: 12 }}>{b}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {species === "dog" ? (
        <>
          <Label>Size (for the age in dog years)</Label>
          <Seg options={[{ id: "small" as DogSize, label: "Small" }, { id: "medium" as DogSize, label: "Medium" }, { id: "large" as DogSize, label: "Large" }]} value={dogSize} onChange={setDogSize} />
        </>
      ) : null}

      <Label>Boy or girl</Label>
      <Seg options={[{ id: "boy" as Gender, label: "Boy" }, { id: "girl" as Gender, label: "Girl" }, { id: "unspecified" as Gender, label: "Not sure" }]} value={gender} onChange={setGender} />

      <Label>Birthday</Label>
      <DateField value={birth} onChange={setBirth} max={today} />
      <Pressable onPress={() => setApprox((v) => !v)} accessibilityRole="checkbox" aria-checked={approx} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
        <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: approx ? t.accent : t.ink3, backgroundColor: approx ? t.accent : "transparent" }} />
        <Text style={[TYPE.bodyMedium, { color: t.ink2, flex: 1 }]}>We're not sure of the exact day (their age will say "about")</Text>
      </Pressable>

      <Label>The day they came home (gotcha day)</Label>
      <DateField value={gotcha} onChange={setGotcha} min={birth} max={today} />

      <Pressable onPress={() => setShowWhere((v) => !v)} accessibilityRole="button" style={{ marginTop: 18 }}>
        <Text style={[TYPE.titleSmall, { color: t.accentDeep }]}>{showWhere ? "▾" : "▸"} Where they came from (optional)</Text>
      </Pressable>
      {showWhere ? (
        <View style={{ backgroundColor: t.bg2, borderRadius: 16, padding: 14, marginTop: 8 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {ORIGINS.map((o) => (
              <Pressable key={o.id} onPress={() => setOrigin(origin === o.id ? null : o.id)} style={chip(origin === o.id)}>
                <Text style={{ color: origin === o.id ? t.onChipOn : t.ink2, fontWeight: "700", fontSize: 12 }}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 12, marginBottom: 6 }]}>The place's name</Text>
          <Input value={placeName} onChangeText={setPlaceName} placeholder="Example: Happy Paws Rescue" />
          <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 12, marginBottom: 6 }]}>Where it is</Text>
          <PlacePicker value={where} onChange={setWhere} />
          <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: 12, marginBottom: 6 }]}>Photos from that day</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {dayPhotos.map((p) => <PhotoView key={p.uri} photo={{ uri: p.uri, kind: "photo", emoji: "📷", palette: "peach" }} style={{ width: 64, height: 64, borderRadius: 12 }} />)}
            <Btn label="Add photos" icon="image" kind="line" onPress={chooseDayPhotos} style={{ alignSelf: "flex-start" }} />
          </View>
        </View>
      ) : null}

      <Label>Colour for their pages</Label>
      <ThemePicker value={theme} onChange={setTheme} order={THEME_ORDER} themes={THEMES} />

      <Label>Profile photo (optional)</Label>
      <Btn label={photoUri ? "Change photo" : "Choose a photo"} icon="image" kind="line" onPress={choosePhoto} />
      {photoUri ? <View style={{ marginTop: 14 }}><AvatarCropper uri={photoUri} value={crop} onChange={setCrop} /></View> : null}

      {err ? <Text style={{ color: t.danger, fontWeight: "700", marginTop: 12 }}>{err}</Text> : null}
      <Btn label={`Start ${name.trim() ? `${name.trim()}'s` : "their"} book ${info.emoji}`} onPress={create} style={{ marginTop: 20 }} />
    </View>
  );
}
