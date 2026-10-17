/*
 * Pets (1.1.0): adding a pet next to "My kid" and "My bump", their age in their own years, their own tabs (Health, Adventures, Weight),
 * reminders as notifications or calendar events, the places they've been and the journey video, their own book themes and pages, up to six
 * owners, and the height and weight comparisons (for children too).
 */
import { untr } from "./untr";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PET_FIRST_IDEAS, TRICK_IDEAS, lifeStage, ownYears, petAge, petRelation, speciesInfo } from "../src/lib/pets";
import { profilePhotosToFamily, siblingRelationOf } from "../src/lib/family";
import { classicsFor, PET_DETAILS_ID, PLACES_ID, REMINDERS_ID } from "../src/lib/classics";
import { Place, onMap, placesByYear, placesSummary, readPlaces, writePlaces } from "../src/lib/places";
import { HealthReminder, calendarRule, nextDates, readReminders } from "../src/lib/reminders";
import { planGotchaNotifications, planHealthReminders } from "../src/lib/petPlan";
import { journeySlides } from "../src/lib/journey";
import { heightInThings, weightInThings, FUN_REFS } from "../src/lib/growth";
import { BOOK_SIZES, defaultPetTheme, petChapter, planBook, stylesFor } from "../src/lib/bookPages";
import { petColumns, petFromRow } from "../src/lib/syncMerge";
import { Child, Memory, Relative } from "../src/lib/types";
import { ClassicEntry } from "../src/lib/classics";

let fails = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fails++; };
const read = (f: string) => untr(readFileSync(join(__dirname, "..", f), "utf8")); // the code as written in English (see untr.ts)

// ---- age in their own years
ok("dogs: 15 at one, 24 at two, then 4, 5 or 6 a year by size (the AVMA guideline)", ownYears("dog", 12) === 15 && ownYears("dog", 24) === 24 && ownYears("dog", 36, "small") === 28 && ownYears("dog", 36, "medium") === 29 && ownYears("dog", 36, "large") === 30);
ok("cats: 15, 24, then 4 a year; horses: 6.5 a year to four, then 2.5", ownYears("cat", 36) === 28 && ownYears("horse", 48) === 26 && ownYears("horse", 72) === 31);
ok("hamsters, birds and snakes have no reliable conversion: a stage of life instead", ownYears("hamster", 12) === null && ownYears("bird", 60) === null && ownYears("snake", 60) === null && lifeStage("hamster", 20) === "Senior" && lifeStage("snake", 6) === "Hatchling");
const rex = petAge({ species: "dog", birth: "2024-07-12", dogSize: "medium" }, "2026-10-12");
ok("“2 years, 3 months” and “about 25 in dog years”, with “about” for a guessed birthday", rex.human === "2 years, 3 months" && rex.own === "about 25 in dog years" && petAge({ species: "cat", birth: "2025-10-01", birthApprox: true }, "2026-10-12").human.startsWith("about ") && !petAge({ species: "bird", birth: "2020-01-01" }, "2026-10-12").own);

// ---- in the family
ok("a pet is “Our dog” in the family (and a child still a sister or brother)", petRelation("dog") === "Our dog" && siblingRelationOf({ theme: "green", kind: "pet", species: "cat" }) === "Our cat" && siblingRelationOf({ theme: "pink", gender: "girl" }) === "Sister");

// ---- their pages
const pet = { kind: "pet", species: "bird" };
ok("a pet's pages: coming home, their name, favourites, their pack and their kind's own (a bird's words), never a child's", classicsFor(pet).some((t) => t.id === "pet-words") && !classicsFor(pet).some((t) => t.id === "teeth" || t.id === "pet-sheds") && classicsFor({ kind: "pet", species: "snake" }).some((t) => t.id === "pet-sheds") && !classicsFor({}).some((t) => t.for === "pet"));
ok("the pages kept for a tab (details, places, reminders) aren't listed or put in the book", ![PET_DETAILS_ID, PLACES_ID, REMINDERS_ID].some((id) => classicsFor(pet).some((t) => t.id === id)) && classicsFor(pet, { hidden: true }).some((t) => t.id === PET_DETAILS_ID));

// ---- places and the journey
const places: Place[] = [
  { id: "a", name: "Hyde Park", lat: 51.5, lon: -0.16, date: "2024-05-01", countryCode: "GB" },
  { id: "b", name: "Brighton beach", lat: 50.8, lon: -0.14, date: "2025-07-10", countryCode: "GB" },
  { id: "c", name: "Paris", lat: 48.85, lon: 2.35, date: "2025-08-20", countryCode: "FR" },
];
ok("places are kept safely (a broken list is no places), by year, with a summary", readPlaces({ places: "oops" }).length === 0 && readPlaces(writePlaces(places)).length === 3 && placesByYear(places).map((y) => `${y.year}:${y.places.length}`).join() === "2024:1,2025:2" && placesSummary(places) === "3 places · 2 countries");
const london = onMap(51.5, -0.16);
ok("a place's spot on the world map", london.x > 0.49 && london.x < 0.5 && london.y > 0.2 && london.y < 0.25 && onMap(-90, 0).y === 1);
const slides = journeySlides(places);
ok("the journey: a slide a year, earlier places already there and the year's new ones popping in", slides.length === 2 && slides[1].pins.filter((p) => p.fresh).length === 2 && slides[1].pins.filter((p) => !p.fresh).length === 1 && /2 new places · 3 in all/.test(slides[1].count));
ok("the journey video draws map slides natively (pins pop in)", /class Pin\(val x: Float, val y: Float, val fresh: Boolean\)/.test(read("modules/video-export/android/src/main/java/expo/modules/videoexport/SlideshowEncoder.kt")) && /private fun drawMapSlide/.test(read("modules/video-export/android/src/main/java/expo/modules/videoexport/SlideshowEncoder.kt")));

// ---- reminders
const flea: HealthReminder = { id: "r", title: "Flea treatment", kind: "parasite", date: "2026-09-05", time: "09:00", repeat: "monthly", notify: true };
ok("a repeating reminder's next dates; a one-off only while it's still to come", nextDates(flea, "2026-10-12", 3).join() === "2026-11-05,2026-12-05,2027-01-05" && nextDates({ ...flea, repeat: "once" }, "2026-10-12").length === 0 && nextDates({ ...flea, repeat: "quarterly" }, "2026-10-12", 1)[0] === "2026-12-05");
ok("a month end stays a month end (31 January, then 28 February)", nextDates({ ...flea, date: "2027-01-31" }, "2027-01-01", 2).join() === "2027-01-31,2027-02-28");
ok("the calendar repeats it the same way", calendarRule(flea)?.frequency === "monthly" && calendarRule({ ...flea, repeat: "quarterly" })?.interval === 3 && calendarRule({ ...flea, repeat: "once" }) === null && readReminders({ list: "{bad" }).length === 0);
ok("calendar events: asks for access, then adds it with an alarm and the repeat", /requestCalendarPermissionsAsync/.test(read("src/lib/calendarEvents.ts")) && /alarms: \[\{ relativeOffset: -60 \}\]/.test(read("src/lib/calendarEvents.ts")) && /"expo-calendar"/.test(read("app.json")));

// ---- notifications
const now = new Date(2026, 9, 12, 12);
const gotcha = planGotchaNotifications([{ id: "p", name: "Rex", gotchaDay: "2024-11-01" }], { enabled: true, daysBefore: 3, hour: 9 }, now);
ok("the gotcha day every year: “2 years since Rex came home!”", gotcha[0].title === "🏡 2 years since Rex came home!" && gotcha[0].date.getMonth() === 10);
const health = planHealthReminders([{ id: "p", name: "Rex", reminders: [flea, { ...flea, id: "x", notify: false }] }], now);
ok("health reminders as notifications, at their time (and not the ones set to calendar only)", health.length === 3 && health[0].title === "🩺 Rex: Flea treatment" && health[0].date.getHours() === 9);
ok("pets get no milestone cheers or monthly photos, but birthdays, gotcha days and their reminders", /const children = born\.filter\(\(k\) => k\.kind !== "pet"\)/.test(read("src/lib/notifications.ts")) && /planGotchaNotifications\(pets, prefs, now\)/.test(read("src/lib/notifications.ts")));

// ---- comparisons (children too)
ok("more heights, all the way from ten to grown-up (up to 210 cm)", FUN_REFS.filter((r) => r.cm > 130 && r.cm <= 210).length >= 15 && FUN_REFS.every((x, i) => i === 0 || x.cm >= FUN_REFS[i - 1].cm));
ok("in multiples too: “As tall as 125 pancakes, stacked”", heightInThings(150, 0)?.text === "As tall as 125 pancakes, stacked" && heightInThings(10) === null);
ok("weights, for pets and children: “As heavy as 5 watermelons”", weightInThings(25).some((x) => x.text === "As heavy as a sack of potatoes") && weightInThings(0.12)[0].text === "As heavy as a banana" && weightInThings(25.2).length === 3 && weightInThings(0.001).length === 0);

// ---- the pet book
const dog: Child = { id: "p", name: "Rex", birth: "2023-03-01", theme: "green", emoji: "🐶", kind: "pet", species: "dog", gotchaDay: "2023-06-01" };
const mem = (id: string, date: string, extra: Partial<Memory> = {}) => ({ id, childId: "p", type: "photo", description: "", date, media: [{ id: id + "m", kind: "photo", uri: `file:///${id}.jpg` }], tagIds: [], createdAt: 1, emoji: "📷", palette: "peach", source: "Added", ...extra } as Memory);
const home: ClassicEntry = { id: "pet-home", childId: "p", values: { date: "2023-06-01", from: "A shelter or rescue", lat: "51.5", lon: "-0.1" }, photos: {} };
const secret: ClassicEntry = { id: PET_DETAILS_ID, childId: "p", values: { microchip: "985112345678901" }, photos: {} };
const plan = planBook(dog, [mem("puppy", "2023-04-01"), mem("walk", "2023-07-01"), mem("beach", "2024-08-01")], BOOK_SIZES[2], { classics: [home, secret], places, mapUri: "file:///map.png", memorial: { words: "Forever ours", dates: "2023 – 2026" } });
const kinds = plan.pages.map((p) => p.kind);
ok("a pet's book opens with the day they came home (no birth page), then their life by years with us", kinds.includes("cameHome") && !kinds.includes("birth") && kinds.indexOf("cameHome") > plan.pages.findIndex((p) => p.chapter?.key === "pre-home"));
ok("chapters count from the day they came home", petChapter(dog, "2023-05-01").label === "Before you came home" && petChapter(dog, "2023-07-01").label === "Your first year with us" && petChapter(dog, "2025-07-01").label === "Your third year with us");
ok("the map of their adventures, and “In loving memory” (straight after the cover) when chosen; the microchip is never in the book", kinds.includes("places") && kinds[1] === "memorial" && !plan.pages.some((p) => p.kind === "classic" && p.entry.id === PET_DETAILS_ID));
ok("a pet's book has its own themes (and a child's never shows them)", stylesFor(dog).map((s) => s.id).join() === "paws,feathers,stable,leafscale" && !stylesFor({}).some((s) => ["paws", "feathers", "stable", "leafscale"].includes(s.id)) && defaultPetTheme("horse") === "stable" && defaultPetTheme("cat") === "paws");
ok("the pet pages are drawn: came home, the map with pins, and the memorial page", /case "cameHome":/.test(read("src/lib/bookHtml.ts")) && /case "places":/.test(read("src/lib/bookHtml.ts")) && /case "memorial":/.test(read("src/lib/bookHtml.ts")) && /"The humans who love you"/.test(read("src/lib/bookHtml.ts")));

// ---- the cloud, and the screens
const row = { ...petColumns(dog), birth_approx: true };
ok("a pet's fields go to the cloud and come back", row.kind === "pet" && row.species === "dog" && petFromRow(row).species === "dog" && petFromRow(row).birthApprox === true && petFromRow({}).kind === undefined);
ok("the database keeps them, and lets a pet have up to six owners (a child still two)", /add column if not exists species text/.test(read("supabase/schema.sql")) && /then 6 else 2 end/.test(read("supabase/schema.sql")) && /MAX_PET_OWNERS = 6/.test(read("src/lib/sync.ts")));
ok("adding: My bump, then My kid, then My pet", (() => { const sc = read("src/components/Screen.tsx"); const b = sc.indexOf("title: \"My bump\""), k = sc.indexOf("title: \"My kid\""), p = sc.indexOf("title: \"My pet\""); return b > 0 && b < k && k < p; })() && /<AddPetForm onDone=\{close\} \/>/.test(read("src/components/Screen.tsx")));
ok("where they came from: who, the place, photos of the day, and a pin on the map or an address", /<PlacePicker value=\{where\} onChange=\{setWhere\} \/>/.test(read("src/components/PetForm.tsx")) && /Photos from that day/.test(read("src/components/PetForm.tsx")) && /nominatim\.openstreetmap\.org/.test(read("src/lib/geocode.ts")));
ok("a pet's four tabs: Home, Health (health and weight), Stories (tricks, firsts and adventures) and Book", /name: "growth", title: "Health"/.test(read("app/(tabs)/_layout.tsx")) && /name: "milestones", title: "Stories"/.test(read("app/(tabs)/_layout.tsx")) && /isPet\(active\) \? PET_TABS : KID_TABS/.test(read("app/(tabs)/_layout.tsx"))
  && /if \(isPet\(child\)\) return <PetHealthTab \/>/.test(read("app/(tabs)/growth.tsx")) && /<PetCare \/> : <PetWeight \/>/.test(read("app/(tabs)/growth.tsx"))
  && /if \(isPet\(child\)\) return <PetStories \/>/.test(read("app/(tabs)/milestones.tsx")) && /<PetTricks child=\{child\} open \/> : <PetAdventures \/>/.test(read("app/(tabs)/milestones.tsx"))
  && !["care", "adventures", "weight"].some((f) => existsSync(join(__dirname, "..", `app/(tabs)/${f}.tsx`))));
ok("the + menu for a pet: no milestones or lasts; weight and health", /const PET_ACTIONS: Action\[\] = \["story", "health", "measure", "first", "voice", "photo"\]/.test(read("src/components/Fab.tsx")));
ok("tricks and firsts on a pet's Stories, not Home; no lasts or milestones in a pet's filters", !/PetTricks/.test(read("app/(tabs)/index.tsx")) && /\(isPet\(child\) \? PET_CATEGORIES : CATEGORIES\)\.map\(/.test(read("app/(tabs)/index.tsx")) && /c\.id !== "last" && c\.id !== "milestone"/.test(read("app/(tabs)/index.tsx")) && !/last/i.test(read("src/lib/pets.ts").split("TRICK_IDEAS")[1].split("PET_HEALTH_KINDS")[0].replace(/lasts?\b.*$/gm, "")));
ok("the age in their own years beside the human age, in the header", /<PetAgeLine child=\{child\} \/>/.test(read("src/components/Screen.tsx")));
ok("Family: Add a pet, next to Add someone", /label="Add a pet"/.test(read("app/family.tsx")) && /Our dog/.test(read("src/lib/pets.ts")));
ok("Settings: Who can see your memories", /Who can see your memories/.test(read("app/settings.tsx")));

// ---- rabbits, profile pictures in the family, the map, pictures together, and a book in their memory
ok("rabbits: their breeds, stages of life, tricks and firsts (no age conversion)", speciesInfo("rabbit").emoji === "🐰" && speciesInfo("rabbit").breeds.includes("Holland Lop") && lifeStage("rabbit", 2) === "Baby" && lifeStage("rabbit", 80) === "Senior" && ownYears("rabbit", 24) === null && TRICK_IDEAS.rabbit.length > 3 && PET_FIRST_IDEAS.rabbit.includes("First binky"));
const kidsP = [{ id: "noa", avatarPhotoId: "m1", avatarCrop: undefined }, { id: "rex", avatarPhotoId: undefined, avatarCrop: undefined }];
const rels = [{ id: "r1", name: "Noa", relation: "Sister", childIds: ["p"], childRef: "noa" }, { id: "r2", name: "Rex", relation: "Our dog", childIds: ["noa"], childRef: "rex", photoUri: "file:///chosen.jpg" }, { id: "r3", name: "Grandma", relation: "Grandma", childIds: ["p"] }] as Relative[];
const photoOf = (id: string) => (id === "m1" ? "file:///noa.jpg" : undefined);
const synced = profilePhotosToFamily(rels, kidsP, photoOf);
ok("a profile picture shows for them in the family too (a picture chosen by hand stays)", synced[0].photoUri === "file:///noa.jpg" && synced[0].photoFromProfile === "m1" && synced[1].photoUri === "file:///chosen.jpg" && synced[2] === rels[2] && profilePhotosToFamily(synced, kidsP, photoOf) === synced);
ok("…and it follows the profile: a new picture replaces it, no picture clears it", profilePhotosToFamily(synced, [{ ...kidsP[0], avatarPhotoId: "m2" }], (id) => `file:///${id}.jpg`)[0].photoUri === "file:///m2.jpg" && profilePhotosToFamily(synced, [{ ...kidsP[0], avatarPhotoId: undefined }], photoOf)[0].photoUri === undefined);
ok("removing them from the family never deletes the profile's own picture", /if \(r\?\.photoUri && !r\.photoFromProfile\) deleteFile/.test(read("src/lib/store.ts")) && /<FamilyPhotoSync \/>/.test(read("app/_layout.tsx")));
ok("the map: smooth free maps (OpenFreeMap, drawn by MapLibre), pins straight away, a tap drops a pin", /tiles\.openfreemap\.org\/styles\/liberty/.test(read("src/components/OsmMap.tsx")) && /maplibre-gl@4\.7\.1/.test(read("src/components/OsmMap.tsx")) && /map\.on\("click"/.test(read("src/components/OsmMap.tsx")) && !/leaflet/i.test(read("src/components/OsmMap.tsx")));
const noaRef: Child = { id: "noa", name: "Noa", birth: "2020-01-01", theme: "green", emoji: "👧" };
const tagged = ["a", "b", "c", "d", "e"].map((x, i) => mem("t" + x, `2024-0${i + 1}-01`, { tagIds: ["tag-person-r1"] }));
const withNoa = planBook(dog, [...tagged, mem("alone", "2024-07-01")], BOOK_SIZES[2], { together: [{ id: "r1", name: "Noa", tagIds: ["tag-person-r1"] }, { id: "r9", name: "Nobody", tagIds: ["tag-person-r9"] }] });
const tPages = withNoa.pages.filter((p) => p.kind === "together");
ok("pictures with a brother, a sister or a pet get pages of their own (“With Noa”)", tPages.length >= 1 && tPages.every((p) => p.kind === "together" && p.who.name === "Noa") && tPages.reduce((n, p) => n + (p.kind === "together" ? p.items.length : 0), 0) === 5 && noaRef.name === "Noa");
ok("…drawn, with every picture loaded and sized for print", /case "together":/.test(read("src/lib/bookHtml.ts")) && /With \$\{esc\(p\.who\.name\)\}/.test(read("src/lib/bookHtml.ts")) && /p\.kind === "pictures" \|\| p\.kind === "together"\) p\.items\.forEach\(\(it\) => out\.add/.test(read("src/lib/bookHtml.ts")));
ok("the Book tab: an “In loving memory” tick for a pet, which changes the cover and adds their page", /In loving memory of \$\{child\.name\}/.test(read("app/(tabs)/book.tsx")) && /set\(\{ inMemory: prefs\.inMemory \? undefined : true \}\)/.test(read("app/(tabs)/book.tsx")) && !/onMemorial/.test(read("src/components/BookExportSheet.tsx")));

console.log(fails ? `${fails} FAILED` : "all pet tests passed");
if (fails) process.exit(1);
