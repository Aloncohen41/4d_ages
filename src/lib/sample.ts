import { addDays, addMonths, toISO } from "./date";
import { Child, MILESTONE_DEFS, Memory, Relative, Tag, TagCategory } from "./types";
import { KIND_META, milestoneMemoryId } from "./entries";
import { makeTag, personTag, uniqueIds, upsertTagIn } from "./tags";

/** A small demo family so the app can be explored before adding real photos. */
export function buildSample() {
  const now = new Date();
  const mayaBirth = toISO(new Date(now.getFullYear() - 2, now.getMonth() - 1, now.getDate()));
  const leoBirth = toISO(new Date(now.getFullYear(), now.getMonth() - 4, now.getDate()));
  const M = (m: number, x = 0) => addDays(addMonths(mayaBirth, m), x);
  const L = (m: number, x = 0) => addDays(addMonths(leoBirth, m), x);
  const ts = Date.now();

  const kids: Child[] = [
    { id: "maya", name: "Maya", birth: mayaBirth, theme: "pink", emoji: "🌸", avatarPhotoId: "m18", gender: "girl" },
    { id: "leo", name: "Leo", birth: leoBirth, theme: "blue", emoji: "🦁", avatarPhotoId: "l8", gender: "boy" },
  ];
  const relatives: Relative[] = [
    { id: "rosa", name: "Rosa", relation: "Grandma", nickname: "Nana", description: "Lives by the sea and bakes on Sundays" },
    { id: "henrik", name: "Henrik", relation: "Grandpa" },
    { id: "priya", name: "Priya", relation: "Aunt", description: "Lives abroad and visits every summer" },
    { id: "marco", name: "Marco", relation: "Uncle" },
    { id: "sarah", name: "Sarah", relation: "Mummy" },
    { id: "tom", name: "Tom", relation: "Daddy" },
  ];

  // tags are kept in one central list; memories only hold their ids
  let registry: Tag[] = [];
  const tagIdOf = (spec: string): string => {
    const i = spec.indexOf(":");
    const cat = spec.slice(0, i) as TagCategory;
    const name = spec.slice(i + 1);
    const tag = cat === "person" ? personTag(relatives.find((r) => r.id === name) as Relative) : makeTag(cat, name);
    registry = upsertTagIn(registry, tag);
    return tag.id;
  };
  const idsOf = (specs: string[] = [], who: string[] = []) => uniqueIds([...specs.map(tagIdOf), ...who.map((id) => tagIdOf(`person:${id}`))]);

  type Extra = Partial<Omit<Memory, "tagIds" | "id" | "childId" | "type" | "date" | "title" | "description" | "emoji">> & { tags?: string[]; people?: string[] };
  const mem = (type: Memory["type"], id: string, childId: string, date: string, emoji: string, description: string, title?: string, extra: Extra = {}): Memory => {
    const { tags, people, ...rest } = extra;
    return {
      id, childId, type, title, description, date, media: [], createdAt: ts, emoji, palette: KIND_META[type].palette, source: KIND_META[type].source,
      ...rest, tagIds: idsOf(tags, people),
    };
  };
  const ph = (id: string, childId: string, date: string, emoji: string, palette: string, description: string, people: string[] = []) =>
    mem("photo", id, childId, date, emoji, description, undefined, { palette, source: "Sample", people });
  const entry = (kind: "first" | "last" | "story", id: string, childId: string, date: string, title: string, emoji: string, description: string, extra: Extra = {}) =>
    mem(kind, id, childId, date, emoji, description, title, extra);
  const milestone = (childId: string, defId: string, date: string, description: string, emoji: string, extra: Extra = {}) =>
    mem("milestone", milestoneMemoryId(childId, defId), childId, date, emoji, description, MILESTONE_DEFS.find((d) => d.id === defId)?.label, { milestoneId: defId, ...extra });
  const measure = (id: string, childId: string, date: string, cm: number, kg: number, title?: string) =>
    mem("measure", id, childId, date, "📏", "", title, { heightCm: cm, weightKg: kg });

  const memories: Memory[] = [
    ph("m1", "maya", M(0), "👶", "peach", "Hello, world. Maya arrived at 7:42 AM — 3.4 kg of pure wonder.", ["rosa", "henrik"]),
    ph("m2", "maya", M(0, 3), "🧸", "rose", "First cuddle with Grandma Rosa. Nobody wanted to take turns.", ["rosa"]),
    ph("m4", "maya", M(1, 2), "💪", "sage", "Tummy time champion — held her head up for a whole minute."),
    ph("m5", "maya", M(2, 5), "🎀", "lav", "Sunday giggles with Aunt Priya and the noisy rattle.", ["priya"]),
    ph("m6", "maya", M(3, 1), "🙌", "sky", "Discovered her own hands. Stared at them for twenty minutes."),
    ph("m7", "maya", M(4, 6), "😴", "cocoa", "Grandpa Henrik's shoulder: officially the best napping spot.", ["henrik"]),
    ph("m9", "maya", M(7, 8), "💦", "sky", "Paddling pool, Uncle Marco on rescue duty.", ["marco"]),
    ph("m11", "maya", M(10, 4), "🎃", "peach", "Pumpkin patch day. She tried to eat a leaf. Twice.", ["rosa", "marco"]),
    ph("m15", "maya", M(18, 6), "📚", "lav", "Library day. She 'read' the book upside down.", ["priya"]),
    ph("m16", "maya", M(20, 3), "🌷", "sage", "Helping Grandma water the garden. Mostly her shoes.", ["rosa"]),
    ph("m18", "maya", M(24, 4), "🎈", "rose", "Two candles, one determined blower.", ["rosa", "henrik", "priya"]),
    // firsts
    entry("first", "f-smile", "maya", M(1, 18), "First smile", "😊", "A slow smile right at Mom during a 3 AM feed.", { time: "03:10", tags: ["other:night"], people: ["sarah"] }),
    entry("first", "f-tooth", "maya", M(7, 2), "First tooth", "🦷", "Bottom left, found mid-bite of a teething ring.", { tags: ["other:teeth"] }),
    entry("first", "f-food", "maya", M(6, 3), "First solid food", "🥑", "Mashed avocado. Review: deeply suspicious.", { tags: ["other:food"], people: ["tom"] }),
    entry("first", "f-word", "maya", M(11, 9), "First word", "🗣️", "“Dada!” — shouted at the dog, but it counts.", { location: "Kitchen", people: ["tom", "sarah"] }),
    entry("first", "f-bday", "maya", M(12), "First birthday", "🎂", "More cake on face than in mouth.", { people: ["rosa", "henrik", "priya", "marco", "sarah", "tom"], tags: ["event:First birthday party"] }),
    entry("first", "f-steps", "maya", M(13, 5), "First steps", "👣", "Three wobbly steps from the sofa to Dad's arms.", { location: "Living room", tags: ["other:walking"], people: ["tom"] }),
    // lasts
    entry("last", "l-bottle", "maya", M(14, 0), "Last bottle", "🍼", "The last evening bottle before cups took over.", { time: "19:30" }),
    entry("last", "l-dummy", "maya", M(20, 10), "Last time using a dummy", "🧸", "She handed it over herself and never asked again.", { tags: ["other:sleep"] }),
    // a story
    entry("story", "s-lake", "maya", M(9, 12), "Our first family trip", "📖", "A whole weekend at the lake. Maya splashed in the shallows, napped in the shade and fell asleep on the drive home with sandy toes.", { location: "Lake Tahoe", time: "16:20", tags: ["event:Family trip", "other:lake"], people: ["rosa", "henrik", "sarah", "tom"], palette: "sky" }),
    // milestones
    milestone("maya", "mov-head", M(1, 5), "Held her head up for a whole minute during tummy time.", "💪"),
    milestone("maya", "mov-rolls", M(4, 2), "Back to tummy, then looked very surprised at herself.", "🔄", { tags: ["other:moving"] }),
    milestone("maya", "lang-babbles", M(7, 0), "A long conversation with the ceiling fan.", "💬"),
    milestone("maya", "mov-sits", M(6, 20), "Wobbled, then stayed up for a full minute.", "🪑"),
    milestone("maya", "mov-crawls", M(8, 10), "Army-crawl first, proper crawl by the weekend.", "🧎", { tags: ["other:moving"] }),
    milestone("maya", "pulls-to-stand", M(10, 3), "Up on the coffee table. Very proud.", "🧍"),
    milestone("maya", "mov-walks", M(13, 20), "Across the whole kitchen without holding on.", "🚶", { location: "Kitchen", tags: ["person:tom"] }),
    // measurements
    measure("mh0", "maya", M(0), 50, 3.4, "At birth"), measure("mh1", "maya", M(3), 61, 6.1), measure("mh2", "maya", M(6), 67, 7.6), measure("mh3", "maya", M(9), 72, 8.9),
    measure("mh4", "maya", M(12), 76.5, 9.6, "One year"), measure("mh5", "maya", M(18), 82, 11), measure("mh6", "maya", M(24), 88, 12.3),

    ph("l1", "leo", L(0), "🦁", "sage", "Leo is here! 3.8 kg and a full head of hair.", ["rosa", "henrik"]),
    ph("l2", "leo", L(0, 2), "🤝", "peach", "Maya meets her baby brother. She offered him a cracker."),
    ph("l4", "leo", L(1, 3), "🛁", "sky", "Bath time splash zone. The rubber duck is his best friend."),
    entry("first", "f-lsmile", "leo", L(2, 2), "First smile", "😊", "Mid-yawn, but we're counting it."),
    ph("l6", "leo", L(2, 20), "✈️", "lav", "Aunt Priya's flying-baby game. Uncontrollable giggles.", ["priya"]),
    ph("l8", "leo", L(4, 1), "🧺", "sage", "Sunday picnic — Leo on charm duty.", ["marco", "rosa"]),
    milestone("leo", "mov-head", L(1, 10), "Chin up, eyes wide.", "💪"),
    milestone("leo", "cog-tracks", L(2, 5), "Tracked the rattle all the way across.", "🔍"),
    measure("lh0", "leo", L(0), 51, 3.8, "At birth"), measure("lh1", "leo", L(2), 59.5, 5.3), measure("lh2", "leo", L(4), 65.5, 6.6),
  ];

  return { kids, relatives, memories, tags: registry };
}
