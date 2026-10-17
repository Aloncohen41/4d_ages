import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { FoundPlace, placeAt, searchPlaces } from "../lib/geocode";
import { useTheme } from "../lib/useTheme";
import { TYPE } from "../theme";
import { Input, Seg } from "./ui";
import { OsmMap } from "./OsmMap";
import { Icon } from "./Icon";

import { tr } from "../lib/i18n";
/**
 * Choosing a place: type an address or a name (OpenStreetMap finds it), or drop a pin on the map. Reports the place, with its point on the
 * map, as soon as one is chosen.
 */
export function PlacePicker({ value, onChange }: { value?: FoundPlace | null; onChange: (p: FoundPlace | null) => void }) {
  const t = useTheme();
  const [how, setHow] = useState<"search" | "map">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundPlace[]>([]);
  const [busy, setBusy] = useState(false);

  // search a moment after typing stops (and never more than once a second: the free service asks for that)
  useEffect(() => {
    if (how !== "search" || query.trim().length < 3) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setBusy(true);
      setResults(await searchPlaces(query));
      setBusy(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [query, how]);

  const dropped = async (p: { lat: number; lon: number }) => {
    onChange({ name: "A pinned place", detail: "", lat: p.lat, lon: p.lon });
    const found = await placeAt(p.lat, p.lon);
    if (found) onChange({ ...found, lat: p.lat, lon: p.lon });
  };

  return (
    <View>
      <Seg options={[{ id: "search" as const, label: tr("Address or name") }, { id: "map" as const, label: tr("Pin on a map") }]} value={how} onChange={setHow} />
      {how === "search" ? (
        <View style={{ marginTop: 10 }}>
          <Input value={query} onChangeText={setQuery} placeholder={tr("Example: Battersea Dogs Home, London")} />
          {busy ? <ActivityIndicator color={t.accent} style={{ marginTop: 8 }} /> : null}
          {results.map((r) => (
            <Pressable key={`${r.lat},${r.lon}`} onPress={() => { onChange(r); setResults([]); setQuery(r.name); }} accessibilityRole="button"
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.line }}>
              <Icon name="place" size={20} color={t.ink2} />
              <View style={{ flex: 1 }}>
                <Text style={[TYPE.bodyLarge, { color: t.ink }]} numberOfLines={1}>{r.name}</Text>
                {r.detail ? <Text style={[TYPE.bodySmall, { color: t.ink3 }]} numberOfLines={1}>{r.detail}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={{ marginTop: 10 }}>
          <Text style={[TYPE.bodySmall, { color: t.ink3, marginBottom: 6 }]}>{tr("Move the map and tap where it is.")}</Text>
          <OsmMap pins={[]} onPick={dropped} start={value ? { lat: value.lat, lon: value.lon } : undefined} />
        </View>
      )}
      {value ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: t.accentSoft, borderRadius: 14, padding: 12, marginTop: 10 }}>
          <Icon name="place" size={20} color={t.onAccentSoft} />
          <View style={{ flex: 1 }}>
            <Text style={[TYPE.titleSmall, { color: t.onAccentSoft }]}>{value.name}</Text>
            {value.detail ? <Text style={[TYPE.bodySmall, { color: t.onAccentSoft }]}>{value.detail}</Text> : null}
          </View>
          <Pressable onPress={() => onChange(null)} accessibilityLabel={tr("Clear the place")} hitSlop={8}><Icon name="x" size={18} color={t.onAccentSoft} /></Pressable>
        </View>
      ) : null}
    </View>
  );
}
