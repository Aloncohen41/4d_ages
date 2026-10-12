import React, { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { useTheme } from "../lib/useTheme";

export interface MapPin { id: string; lat: number; lon: number; label: string }

/*
 * A map from OpenStreetMap (free, no key), in a small web view: pins for the places a pet has been, or a pin the parent drops to mark a place.
 * Leaflet draws it; the map data and tiles come from OpenStreetMap, credited on the map.
 */
const page = (accent: string, pins: MapPin[], picking: boolean, start?: { lat: number; lon: number }) => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;height:100%;background:#eef1f3}.pin{width:18px;height:18px;border-radius:9px;background:${accent};border:3px solid #fff;box-shadow:0 1px 4px #0006}</style>
</head><body><div id="map"></div><script>
var map = L.map("map", { zoomControl: true, attributionControl: true, worldCopyJump: true });
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(map);
var icon = L.divIcon({ className: "", html: '<div class="pin"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
var pins = ${JSON.stringify(pins)};
var picked = null;
pins.forEach(function (p) { L.marker([p.lat, p.lon], { icon: icon }).addTo(map).bindTooltip(p.label); });
if (pins.length > 1) map.fitBounds(pins.map(function (p) { return [p.lat, p.lon]; }), { padding: [30, 30], maxZoom: 12 });
else if (pins.length === 1) map.setView([pins[0].lat, pins[0].lon], 11);
else ${start ? `map.setView([${start.lat}, ${start.lon}], 12)` : "map.setView([30, 10], 1)"};
${picking ? `map.on("click", function (e) {
  if (picked) picked.setLatLng(e.latlng); else picked = L.marker(e.latlng, { icon: icon }).addTo(map);
  window.ReactNativeWebView.postMessage(JSON.stringify({ lat: e.latlng.lat, lon: e.latlng.lng }));
});` : ""}
</script></body></html>`;

/** The map. `onPick` makes it a picker: a tap drops the pin and reports where. */
export function OsmMap({ pins, onPick, start, height = 260 }: { pins: MapPin[]; onPick?: (p: { lat: number; lon: number }) => void; start?: { lat: number; lon: number }; height?: number }) {
  const t = useTheme();
  const html = useMemo(() => page(t.accent, pins, !!onPick, start), [t.accent, pins, onPick, start]);
  const latest = useRef(onPick);
  useEffect(() => { latest.current = onPick; }, [onPick]);
  return (
    <View style={{ height, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: t.line }}>
      <WebView
        originWhitelist={["*"]}
        source={{ html, baseUrl: "https://4dages.local/" }}
        onMessage={(e) => { try { latest.current?.(JSON.parse(e.nativeEvent.data)); } catch { /* not ours */ } }}
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        style={{ backgroundColor: "transparent" }}
      />
    </View>
  );
}
