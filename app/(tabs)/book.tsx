import React, { useMemo, useState } from "react";
import { isPet } from "../../src/lib/types";
import { onWeb } from "../../src/lib/onWeb";
import { PLACES_ID } from "../../src/lib/classics";
import { readPlaces } from "../../src/lib/places";
import { useWorldMap } from "../../src/lib/worldMap";
import { Pressable, Text, View } from "react-native";
import { useScreenWidth } from "../../src/lib/useWide";
import { Screen } from "../../src/components/Screen";
import { Btn, DateField, Heading, Input, Seg } from "../../src/components/ui";
import { Icon } from "../../src/components/Icon";
import { BookOverview, BookPreviewModal } from "../../src/components/BookPreview";
import { BookPostsSheet } from "../../src/components/BookPostsSheet";
import { BookCustomizer } from "../../src/components/BookCustomizer";
import { useShownChild, useStore } from "../../src/lib/store";
import { useTheme } from "../../src/lib/useTheme";
import { TYPE } from "../../src/theme";
import { MILESTONE_DEFS } from "../../src/lib/types";
import {
  BOOK_COLOURS, BOOK_PHOTO_LIMIT, BOOK_SIZES, BOOK_STYLES, BookPrefs, bookName, DEFAULT_BOOK_SIZE, colourById, inBook, planBook, selectForBook, sizeById, startsAtBirth, styleById, PET_THEMES, defaultPetTheme,
} from "../../src/lib/bookPages";
import { BookDestination, exportBook } from "../../src/lib/pdf";
import { familyOf, orderedFamily } from "../../src/lib/family";
import { displayName } from "../../src/lib/tags";
import { formatDate, todayISO } from "../../src/lib/date";

import { tr } from "../../src/lib/i18n";
export default function BookTab() {
  return (
    <Screen>
      <Book />
    </Screen>
  );
}

/**
 * The keepsake book, ready made: the day they were born, their family, then every memory in the order it happened, in chapters by age. Choose
 * the dates it covers and the posts in it (or make it about one person), a theme, a colour and a print size; see every page; then save the PDF
 * to the phone or share it, at exactly that size. The choices are kept for each child.
 */
function Book() {
  const t = useTheme();
  const width = useScreenWidth();
  const child = useShownChild();
  const memories = useStore((s) => s.memories);
  const custom = useStore((s) => s.customDefs);
  const relatives = useStore((s) => s.relatives);
  const tagList = useStore((s) => s.tags);
  const familyOrder = useStore((s) => s.familyOrder);
  const weightUnit = useStore((s) => s.weightUnit);
  const heightUnit = useStore((s) => s.heightUnit);
  const allPrefs = useStore((s) => s.bookPrefs);
  const allClassics = useStore((s) => s.classics);
  const kids = useStore((s) => s.kids);
  const setBookPrefs = useStore((s) => s.setBookPrefs);
  const [previewAt, setPreviewAt] = useState<number | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState<BookDestination | null>(null);
  const [progress, setProgress] = useState("");
  const [customizing, setCustomizing] = useState(false); // the Customize view: the theme and colour, and exporting from there
  const [msg, setMsg] = useState("");

  const prefs: BookPrefs = (child && allPrefs[child.id]) || {};
  // a pet's book starts in the theme for its kind of pet, and never uses a child's theme (or the other way round)
  const saved = styleById(prefs.style);
  const style = child && isPet(child) ? (PET_THEMES.includes(saved) && prefs.style ? saved : defaultPetTheme(child.species)) : PET_THEMES.includes(saved) ? "classic" : saved;
  const mapUri = useWorldMap();
  const placesEntry = useStore((s) => s.classics.find((c) => c.childId === child?.id && c.id === PLACES_ID));
  const places = useMemo(() => readPlaces(placesEntry?.values), [placesEntry]);
  const colour = colourById(prefs.colour);
  const size = sizeById(prefs.size ?? DEFAULT_BOOK_SIZE);
  const set = (patch: Partial<BookPrefs>) => child && setBookPrefs(child.id, patch);
  const person = prefs.personId ? relatives.find((r) => r.id === prefs.personId) : undefined;

  const defs = useMemo(() => [...MILESTONE_DEFS, ...(child ? custom[child.id] || [] : [])], [custom, child]);
  // a book of brothers and sisters: the children ticked below, with this one
  const siblings = useMemo(() => (child ? kids.filter((k) => k.id !== child.id && k.role !== "viewer" && (prefs.siblings ?? []).includes(k.id)) : []), [kids, child, prefs.siblings]);
  const inBookIds = useMemo(() => new Set([child?.id, ...siblings.map((k) => k.id)]), [child, siblings]);
  const family = useMemo(() => {
    if (!child) return [];
    const seen = new Set<string>();
    return [child, ...siblings].flatMap((k) => orderedFamily(familyOf(relatives, k.id).filter((r) => !r.childRef || !inBookIds.has(r.childRef)), familyOrder[k.id]))
      .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  }, [relatives, child, siblings, familyOrder, inBookIds]);
  const mine = useMemo(() => (child ? memories.filter((m) => inBookIds.has(m.childId)) : []), [memories, child, inBookIds]);
  // the posts the book could hold with these dates (and person), whether or not you left some out: the "Choose posts" list
  // each child's birthday, so the pregnancy can be left out (an expecting child's book is all pregnancy, so it always stays)
  const births = useMemo(() => Object.fromEntries([child, ...siblings].filter((k): k is NonNullable<typeof k> => !!k && !k.expecting).map((k) => [k.id, k.birth])), [child, siblings]);
  const candidates = useMemo(() => selectForBook(mine.filter(inBook), { ...prefs, excluded: [] }, tagList, births).sort((a, b) => (a.date < b.date ? 1 : -1)), [mine, prefs, tagList, births]);
  const chosen = useMemo(() => [...selectForBook(mine.filter(inBook), prefs, tagList, births), ...mine.filter((m) => !inBook(m) && (prefs.pregnancy !== false || !births[m.childId] || m.date >= births[m.childId]))], [mine, prefs, tagList, births]);
  const pregnancyPosts = useMemo(() => mine.filter((m) => births[m.childId] && m.date < births[m.childId]).length, [mine, births]);
  const intro = child ? startsAtBirth(child, prefs) : true;
  const otherKids = child ? kids.filter((k) => k.id !== child.id && k.role !== "viewer") : [];
  const classics = useMemo(() => (child ? allClassics.filter((c) => c.childId === child.id) : []), [allClassics, child]);
  // a pet's book in their memory: from the year they were born to the year of their last post
  const inMemory = !!child && isPet(child) && !!prefs.inMemory;
  const lastYear = mine.reduce((y, m) => (m.date > y ? m.date : y), child?.birth ?? todayISO()).slice(0, 4);
  const memorialPage = child && inMemory ? { words: prefs.memorialWords ?? "", dates: `${child.birth.slice(0, 4)} – ${lastYear}` } : undefined;
  const title = child && person ? `${child.name} & ${displayName(person)}` : child && inMemory ? `In loving memory of ${child.name}` : undefined;
  const subtitle = person ? "Our moments together" : prefs.from || prefs.to ? `${formatDate(prefs.from || child?.birth || todayISO())} – ${formatDate(prefs.to || todayISO())}` : memorialPage ? memorialPage.dates : undefined;
  // the page count follows the size and the content
  // the brothers, sisters and pets in the family who aren't in this book: the pictures they're tagged in get pages of their own
  const together = useMemo(() => (person ? [] : family.filter((r) => r.childRef && kids.some((k) => k.id === r.childRef)).map((r) => ({
    id: r.id, name: displayName(r), tagIds: [`tag-person-${r.id}`, ...tagList.filter((x) => x.relatedFamilyMemberId === r.id).map((x) => x.id)],
  }))), [family, kids, tagList, person]);
  const plan = useMemo(() => (child ? planBook(child, chosen, size, { family, intro, classics, siblings, places, mapUri, memorial: memorialPage, together }) : null), [child, chosen, size, family, intro, classics, siblings, places, mapUri, memorialPage?.words, memorialPage?.dates, together]); // eslint-disable-line react-hooks/exhaustive-deps
  const input = useMemo(
    () => (child && plan ? { child, siblings, plan, defs, style, colour, size, relatives, tags: tagList, weightUnit, heightUnit, title, subtitle } : null),
    [child, siblings, plan, defs, style, colour, size, relatives, tagList, weightUnit, heightUnit, title, subtitle],
  );
  if (!child || !plan || !input) return null;
  const leftOut = candidates.filter((m) => prefs.excluded?.includes(m.id)).length;

  const doExport = async (to: BookDestination) => {
    setBusy(to);
    setMsg("");
    setProgress("");
    try {
      const done = await exportBook({ child, defs, memories: chosen, style, colour, size: size.id, relatives, family, classics, siblings, places, mapUri, memorial: memorialPage, together, tags: tagList, weightUnit, heightUnit, intro, title, subtitle }, to, setProgress);
      if (done === "saved") setMsg(onWeb ? "" : tr("Saved. You'll find the PDF where you chose (Downloads, Drive or a folder)."));
      if (done === "shared") setMsg("");
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : tr("Couldn't build the PDF. Try again."));
    } finally {
      setBusy(null);
      setProgress("");
    }
  };

  const label = (s: string, top = 22) => <Text style={[TYPE.labelLarge, { color: t.ink2, marginTop: top, marginBottom: 8 }]}>{s}</Text>;

  return (
    <View>
      <Heading title={bookName(child, todayISO())} desc={tr("Their book, ready made from their photos and milestones, in date order from the day they were born.")} />

      {person ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: t.accent, marginBottom: 12 }}>
          <Icon name="family" size={20} color={t.accent} />
          <Text style={[TYPE.bodyMedium, { color: t.ink, flex: 1 }]}>{tr("A book about {0}: only the posts they are in.", [displayName(person)])}</Text>
          <Pressable onPress={() => set({ personId: undefined })} accessibilityLabel={tr("Make the whole book again")} hitSlop={8}><Icon name="x" size={20} color={t.ink2} /></Pressable>
        </View>
      ) : null}

      {/* the cover and the first pages, exactly as they will be printed */}
      <BookOverview input={input} count={plan.pages.length} width={width - 32} onOpen={setPreviewAt} />

      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 16 }}>
        <Text style={[TYPE.titleMedium, { color: t.ink }]}>{tr("{0} pages", [plan.pages.length])}</Text>
        <Text style={[TYPE.bodyMedium, { color: t.ink3 }]}>{tr("{0} photo{1}", [plan.pictures, plan.pictures === 1 ? "" : "s"])}</Text>
      </View>
      {plan.available > plan.pictures ? (
        <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 2 }]}>{tr("Up to {0} photos fit in one book, chosen evenly across the years. The rest of those memories are in it as words.", [BOOK_PHOTO_LIMIT])}</Text>
      ) : null}
      <Btn label={tr("Customize the book")} icon="t-star" onPress={() => { setMsg(""); setCustomizing(true); }} style={{ marginTop: 12 }} />
      <Btn label={tr("Preview all {0} pages", [plan.pages.length])} icon="nav-book" kind="line" onPress={() => setPreviewAt(0)} style={{ marginTop: 8 }} />

      {label("What's in the book")}
      {otherKids.length ? (
        <View style={{ marginBottom: 10 }}>
          <Text style={[TYPE.labelMedium, { color: t.ink3, marginBottom: 6 }]}>{tr("Children in this book")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: t.chipOn }}><Text style={{ color: t.onChipOn, fontWeight: "700" }}>{child.name}</Text></View>
            {otherKids.map((k) => {
              const on = (prefs.siblings ?? []).includes(k.id);
              return (
                <Pressable key={k.id} onPress={() => set({ siblings: on ? (prefs.siblings ?? []).filter((x) => x !== k.id) : [...(prefs.siblings ?? []), k.id] })} accessibilityRole="checkbox" aria-checked={on}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: on ? t.chipOn : t.line, backgroundColor: on ? t.chipOn : t.card }}>
                  <Icon name={on ? "check" : "plus"} size={16} color={on ? t.onChipOn : t.ink2} />
                  <Text style={{ color: on ? t.onChipOn : t.ink2, fontWeight: "700" }}>{k.name}</Text>
                </Pressable>
              );
            })}
          </View>
          {siblings.length ? <Text style={[TYPE.bodySmall, { color: t.ink3, marginTop: 6 }]}>{tr("One book for {0}, in date order, with chapters by year.", [[child, ...siblings].map((k) => k.name).join(" and ")])}</Text> : null}
        </View>
      ) : null}
      {pregnancyPosts ? (
        <Pressable onPress={() => set({ pregnancy: prefs.pregnancy === false ? undefined : false })} accessibilityRole="checkbox" aria-checked={prefs.pregnancy !== false}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, marginBottom: 6 }}>
          <Icon name={prefs.pregnancy !== false ? "check-square" : "square"} size={24} color={prefs.pregnancy !== false ? t.accent : t.ink3} />
          <View style={{ flex: 1 }}>
            <Text style={[TYPE.bodyLarge, { color: t.ink }]}>{tr("Include the pregnancy")}</Text>
            <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{tr("{0} {1} from before the birth: scans, the bump, cravings and milestones", [pregnancyPosts, pregnancyPosts === 1 ? "post" : "posts"])}</Text>
          </View>
        </Pressable>
      ) : null}
      {isPet(child) ? (
        <View style={{ marginBottom: 6 }}>
          <Pressable onPress={() => set({ inMemory: prefs.inMemory ? undefined : true })} accessibilityRole="checkbox" aria-checked={!!prefs.inMemory}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
            <Icon name={prefs.inMemory ? "check-square" : "square"} size={24} color={prefs.inMemory ? t.accent : t.ink3} />
            <View style={{ flex: 1 }}>
              <Text style={[TYPE.bodyLarge, { color: t.ink }]}>{tr("In loving memory")}</Text>
              <Text style={[TYPE.bodySmall, { color: t.ink3 }]}>{tr("Makes it a book to remember {0} by: \"In loving memory of {1}\" on the cover, and a page for them after it", [child.name, child.name])}</Text>
            </View>
          </Pressable>
          {prefs.inMemory ? <Input value={prefs.memorialWords ?? ""} onChangeText={(v) => set({ memorialWords: v })} placeholder={tr("A few words. Example: Our best friend, forever in our hearts")} multiline style={{ minHeight: 60, textAlignVertical: "top" }} /> : null}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.labelMedium, { color: t.ink3, marginBottom: 4 }]}>{tr("From")}</Text>
          <DateField value={prefs.from || child.birth} min={child.birth} max={prefs.to || todayISO()} onChange={(d) => set({ from: d <= child.birth ? undefined : d })} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.labelMedium, { color: t.ink3, marginBottom: 4 }]}>{tr("To")}</Text>
          <DateField value={prefs.to || todayISO()} min={prefs.from || child.birth} max={todayISO()} onChange={(d) => set({ to: d >= todayISO() ? undefined : d })} />
        </View>
      </View>
      {prefs.from || prefs.to ? <Btn label={tr("From birth to today")} kind="line" onPress={() => set({ from: undefined, to: undefined })} style={{ marginTop: 8 }} /> : null}
      <Btn label={leftOut ? tr("Choose posts ({0} left out)", [leftOut]) : tr("Choose posts")} icon="select" kind="line" onPress={() => setChoosing(true)} style={{ marginTop: 8 }} />

      {label("Page size", 18)}
      <View style={{ gap: 6 }}>
        {BOOK_SIZES.map((s) => {
          const on = s.id === size.id;
          return (
            <Pressable key={s.id} onPress={() => set({ size: s.id })} accessibilityRole="radio" aria-checked={on} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? t.accent : t.line, backgroundColor: t.card }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? t.accent : t.outline, alignItems: "center", justifyContent: "center" }}>
                {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.accent }} /> : null}
              </View>
              <Text style={[TYPE.bodyMedium, { color: t.ink, flex: 1 }]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* the theme and colour are chosen in the Customize view, and the book is exported from there (its share button, top right) */}
      <Btn label={tr("Customize and export")} icon="pdf" onPress={() => { setMsg(""); setCustomizing(true); }} style={{ marginTop: 18 }} />
      <Text style={{ color: t.ink4, fontSize: 12, textAlign: "center", marginTop: 8 }}>{tr("{0} · {1} pages", [size.label, plan.pages.length])}</Text>
      {customizing ? (
        <BookCustomizer input={input} pages={plan.pages.length} pet={isPet(child)} onStyle={(v) => set({ style: v })} onColour={(c) => set({ colour: c })}
          onClose={() => setCustomizing(false)} onExport={doExport} busy={busy} progress={progress} message={msg} />
      ) : null}

      {previewAt !== null ? <BookPreviewModal input={input} pages={plan.pages.length} start={previewAt} onClose={() => setPreviewAt(null)} /> : null}
      {choosing ? <BookPostsSheet posts={candidates} defs={defs} excluded={prefs.excluded ?? []} onChange={(excluded) => set({ excluded })} onClose={() => setChoosing(false)} /> : null}
    </View>
  );
}
