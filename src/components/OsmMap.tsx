import React, { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { WebFrame as WebView } from "./WebFrame";
import { useTheme } from "../lib/useTheme";

export interface MapPin { id: string; lat: number; lon: number; label: string }

/*
 * A map in a small web view: smooth vector maps from OpenFreeMap (free, no key, OpenStreetMap data), drawn by MapLibre. Pins for the places a
 * pet has been, or a pin the parent drops to mark a place. Credited on the map.
 */
const page = (accent: string, pins: MapPin[], picking: boolean, start?: { lat: number; lon: number }) => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css">
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<style>html,body,#map{margin:0;height:100%;background:#eef1f3}.pin{width:16px;height:16px;border-radius:50%;box-sizing:content-box;background:${accent};border:3px solid #fff;box-shadow:0 1px 4px #0006}.maplibregl-ctrl-attrib{font-size:10px}</style>
</head><body><div id="map"></div><script>
var pins = ${JSON.stringify(pins)};
// the view is set from the start (all the places in sight), and the pins are added straight away: neither waits for the map to finish loading
var view = pins.length > 1
  ? { bounds: pins.reduce(function (b, p) { return b.extend([p.lon, p.lat]); }, new maplibregl.LngLatBounds([pins[0].lon, pins[0].lat], [pins[0].lon, pins[0].lat])), fitBoundsOptions: { padding: 40, maxZoom: 12 } }
  : pins.length === 1 ? { center: [pins[0].lon, pins[0].lat], zoom: 11 } : { center: [${start ? start.lon : 10}, ${start ? start.lat : 30}], zoom: ${start ? 12 : 1} };
var map = new maplibregl.Map(Object.assign({ container: "map", style: "https://tiles.openfreemap.org/styles/liberty", attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false }, view));
map.touchZoomRotate.disableRotation();
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
function pin(lng, lat, label) { var el = document.createElement("div"); el.className = "pin"; var m = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]); if (label) m.setPopup(new maplibregl.Popup({ offset: 12, closeButton: false }).setText(label)); return m.addTo(map); }
pins.forEach(function (p) { pin(p.lon, p.lat, p.label); });
${picking ? `var picked = null;
map.on("click", function (e) {
  if (picked) picked.setLngLat(e.lngLat); else picked = pin(e.lngLat.lng, e.lngLat.lat);
  window.ReactNativeWebView.postMessage(JSON.stringify({ lat: e.lngLat.lat, lon: e.lngLat.lng }));
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
