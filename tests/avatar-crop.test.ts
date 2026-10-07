import { defaultCrop, clampCrop, cropLayout, dragCrop, zoomCrop, recenter, faceHigh } from "../src/lib/crop";
let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
// ---------- crop maths
const sq = defaultCrop(1);
ok("square photo, zoom 1: fills frame exactly", JSON.stringify(cropLayout(100, sq)) === JSON.stringify({ width: 100, height: 100, left: 0, top: 0 }));
const land = defaultCrop(1.5);
const L = cropLayout(100, land);
ok("landscape: height fills frame, width overflows (not stretched)", Math.abs(L.height - 100) < 1e-9 && Math.abs(L.width - 150) < 1e-9 && Math.abs(L.width / L.height - 1.5) < 1e-9 && Math.abs(L.left - -25) < 1e-9);
const port = defaultCrop(0.75);
const P = cropLayout(100, port);
ok("portrait: width fills, height overflows", Math.abs(P.width - 100) < 1e-9 && Math.abs(P.height - 133.3333333) < 1e-4);
const dragged = dragCrop(land, -30, 0, 100); // finger moves left → shows more of the RIGHT of the photo
ok("dragging left reveals the right side; clamped at the edge", dragged.x > 0.5 && dragCrop(land, -9999, 0, 100).x <= 0.6667 + 1e-9 && dragCrop(land, 9999, 0, 100).x >= 0.3333 - 1e-9);
ok("landscape can't move vertically at zoom 1", dragCrop(land, 0, 80, 100).y === 0.5);
ok("portrait can move vertically (face up / down)", dragCrop(port, 0, 40, 100).y < 0.5 && dragCrop(port, 0, 40, 100).y > 0.25);
const z = zoomCrop(sq, 2);
ok("zoom in: twice the size, centred; range limited 1..4", cropLayout(100, z).width === 200 && zoomCrop(sq, 99).zoom === 4 && zoomCrop(sq, 0.2).zoom === 1);
ok("after zooming, edges never show empty space", [land, port, sq].every((c0) => [1, 1.7, 3, 4].every((zm) => { const c = clampCrop({ ...c0, zoom: zm, x: 0, y: 1 }); const l = cropLayout(100, c); return l.left <= 1e-9 && l.top <= 1e-9 && l.left + l.width >= 100 - 1e-9 && l.top + l.height >= 100 - 1e-9; })));
ok("recentre & face-high presets", recenter({ ...port, x: 0.9, y: 0.9, zoom: 3 }).zoom === 1 && recenter({ ...land, x: 0.6 }).x === 0.5 && faceHigh(port).y < 0.5 && faceHigh(port).y >= 0.375 - 0.1);

console.log(fails ? `${fails} FAILED` : "all crop tests passed");
