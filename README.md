# 4D Ages (Android / Expo SDK 57)

A baby-book app: a timeline per child, milestones with any emoji and photo/video attachments,
family tagging, a "Watch them grow" player, and a PDF baby book. You choose every photo — nothing is
scanned and no face data is created.

## Run it on your phone

Put this folder somewhere with a SHORT path, e.g. `C:\dev\4d-ages` (not Desktop/OneDrive).

```
npm install
npm run setup          # REQUIRED, once: installs the Expo libraries at the right versions for SDK 57
npm run doctor         # should say "No issues detected" (or list what to fix)
adb devices            # your phone must be listed as "device"
npm run android:sync   # generates the Android project (also whenever icons, the name or the plugins change)
npm run android        # builds a development app and installs it on the phone (10-30 min the first time)
```

`npm install` alone is **not** enough: the Expo libraries (the router, safe-area, tabs, images…) are installed by `npm run setup`, so that each gets the
version that matches Expo. You don't have to remember this: a **setup check runs by itself** before `npm start`, `npm run android` and
`npm run android:sync`, and says in plain words what is missing (a skipped `npm run setup`, picture files that didn't come across when unzipping, an invalid
app id or link scheme). Run it any time with `npm run check` (`SKIP_SETUP_CHECK=1` skips it). The project's `.npmrc` relaxes npm's react / react-dom
peer-dependency check, which otherwise stops installs with an `ERESOLVE` error — so no `--legacy-peer-deps` flag is needed (`tests/check-setup.test.ts`
guards both, and fails if the app ever imports a library that setup doesn't install).

After that, day to day: `npm start`, then open "4D Ages" on the phone.

## Make a standalone APK (runs without the computer)

```
npx expo prebuild --platform android
cd android
gradlew.bat assembleRelease          # macOS/Linux: ./gradlew assembleRelease
```

APK: `android/app/build/outputs/apk/release/app-release.apk`
Install: `adb install -r app-release.apk` (or copy it to the phone and tap it).

This APK is signed with the debug key — fine for your own phone. Before sharing with family,
use the releases below so one stable key signs every update.
Switching keys later forces an uninstall, which erases the app's data.

## Releases (GitHub Actions)

GitHub builds the APK, signs it with the release key and publishes it; nobody needs Android Studio or Java for that.

- **Every push and pull request** (`.github/workflows/ci.yml`): `npm run check`, `npm run typecheck`, `npm test`.
- **A tag `v<version>`** (`.github/workflows/release.yml`): the same checks, then the signed APK, attached to a new GitHub Release
  as `4d-ages-<version>.apk` with its SHA-256. The *Run workflow* button on the Actions tab does the same without publishing: the APK is
  an artifact of the run, which is the way to try a build first.

**Once: make the release key and give it to GitHub.**

```
npm run signing:key                                 # writes ~/4d-ages-signing/release.keystore and github-secrets.env
gh secret set -f ~/4d-ages-signing/github-secrets.env
gh secret set EXPO_PUBLIC_SUPABASE_URL              # the two public values from your .env (it asks for each value)
gh secret set EXPO_PUBLIC_SUPABASE_ANON_KEY
```

Keep a copy of `~/4d-ages-signing` somewhere safe (a password manager). Android only installs an update signed with the same key as the
app already on the phone, so a lost key means everyone uninstalls — and loses every memory that isn't in the shared online copy. For the
same reason, an app installed from a debug-signed APK can't be updated by a release. If a phone already holds memories in such a build,
either turn on sharing there first (SHARING.md) so they come back after the reinstall, or use that build's `debug.keystore` as the
release key instead of making a new one (its base64, password `android` and alias `androiddebugkey` as the four `ANDROID_…` secrets).
Without the two Supabase secrets the build still succeeds (with a warning) but sharing between parents is off in that APK.

**Each release:**

1. Set the new version in `app.json` (`expo.version`) and `src/brand.ts` (`APP_VERSION`) — `npm test` checks they agree — and push to `main`.
2. `git tag v1.1.0 && git push origin v1.1.0` (the tag must be `v` + that version, or the run stops straight away).

The build number Android compares (`versionCode`) is the number of the workflow run, so it rises by itself; `app.config.js` reads it from
`ANDROID_VERSION_CODE`. Before publishing, the workflow checks that the APK really is signed with the release key and stops if it isn't.

## What's inside

- `app/(tabs)/` — Timeline, Firsts (milestones), Family, Book, Add
- `src/lib/` — store (zustand + AsyncStorage), dates/ages, photo picking, PDF builder
- `src/components/` — shared UI, emoji picker (1,906 emojis), player, profile sheets

## Also included

- **Growth tab** — log heights (cm or inches), growth curve with an approximate typical-range band (WHO, 0-5 years,
  simplified), door-frame marks with familiar objects for scale, and a ruler beside the pages in the PDF book.
- **Year in review** — highlights of each year of life (every milestone + the best photo of each month),
  playable, exportable as a PDF. A banner appears a week before each birthday.
- **On this day** — photos from the same date in earlier years.

## The "+" button (quick add)

A floating **+** in the bottom-right corner of every tab fans out five options: **Story**, **Milestone**, **Height / Weight**,
**First** and **Last**. Each opens one lightweight form.

| Type | What it is | Supports |
|---|---|---|
| **Story** | A general memory or journal entry | text, photos, date + optional time, location, tags |
| **Milestone** | One of the chart's milestones (below), or one of your own | date + optional time, notes, tags, photo; the photo becomes the milestone's main picture |
| **First** | Something they did for the first time (first smile, steps, word, flight, day at nursery…) | title, description, date/time, location, photo(s), tags |
| **Last** | A meaningful last time (last bottle, last diaper, last time in the cot…) | same as First |
| **Height / Weight** | A measurement — together or separately | height, weight, date, note, photo, tags |

The **Milestones** tab has three views: *Milestones* (the checklist, below), *Firsts* and *Lasts* (idea chips to tap). Heights and weights live in the **Growth** tab with a Height | Weight switch, and height comes with
28 "as tall as…" comparisons across six categories (everyday objects, toys, animals, furniture, household items, fun objects).
The timeline can be filtered by type (Stories, Milestones, Firsts, Lasts, Growth, Photos) and by tag. Existing "First …" milestones from
earlier versions move to Firsts automatically.

## Milestones, celebrated

The milestone list follows ZERO TO THREE's **Developmental Milestones by Age** chart (birth to 36 months): four areas of development —
**Social & Emotional, Language, Cognitive, Movement** — across six age bands (0–6, 6–12, 12–18, 18–24, 24–30, 30–36 months), 56
milestones in all. They are a roadmap, not a test: nothing is ever shown "out of" a total, and nothing is called late or behind.

- **A checklist that's already there.** Every milestone is listed under its area. Tap an empty circle to tick it off (tap again to
  undo); once ticked, a pencil lets you add the date, notes, photos and tags. Ticking creates a milestone in the child's story.
  If a milestone from a much earlier stage is ticked, you're asked roughly when it happened instead of it being dated today.
- **Earlier · Now · Coming up.** Switch between the stages already passed, the current one and the next two.
- **"Is this happening?"** A short list of milestones worth looking out for right now, starting 1/6 of the way before a stage opens
  (5, 10, 15, 20 and 25 months). **Yes!** ticks it off; **Not yet** just means it's asked again in a month.
- **Reinforce** (the button beside the title) is a page you open yourself: *"Wow, Chloe is really good at language!"* and, if there is
  an area where a little extra play could help, three simple things to try together for the right age. It only ever uses milestones
  you've answered: an area with nothing ticked is just "to explore", and a "not yet" on something still inside its usual stage is
  treated as completely normal. Layout follows the Outstanding / On track / Reinforce cards of the reference app, in this app's colours.
- **Notifications** (Add tab → *Reminders & cheers*, each has its own switch): on the day they reach a new month,
  *"🎉 Wow — Chloe is 6 months old today!"*; and before each new stage, *"👀 Is Chloe starting any of these?"* naming three
  milestones that aren't ticked yet. Tapping either opens the Milestones tab. Birthdays keep their own reminder. Notifications are
  scheduled when the app opens (the next ~64), so open it now and then.
- **Nothing you logged is lost.** The earlier milestone list is kept: milestones you already logged still appear, ticked, under
  the matching chart milestone (e.g. an earlier "Crawls" shows as ticked "Crawls or scoots"), and the rest appear under *Your other milestones*.

## Photos are shown whole

Photos are never cropped to fit. On the timeline, in milestone / first / last cards and in the entry form, the frame takes the
photo's own shape (anything very wide or very tall is letterboxed rather than cut). The Watch-them-grow player and the exported
video fit the whole photo inside the frame over a soft blurred copy of itself. Only small thumbnails and round pictures crop —
and for the round ones you choose the crop (below).

## Profile pictures you can position

Tap the child's picture → choose a photo → **Position the picture**: drag it, pinch or use the slider to zoom, **Centre** or
**Face higher** to recentre. The same cropper is used when adding a child and for family members.

## Tags — one system for everything

Photos, stories, milestones, firsts, lasts and measurements all use the same tags, in four kinds: **Person / Family**, **Event**,
**Location** and **Custom / Other**. Add them with the same picker everywhere (including the import screen). Tap any tag to see
everything that carries it, or open **🏷️ Tags & search** on the timeline to browse and search — "Grandma" finds every Grandma, and
you can view several people together. A memory's Location field counts as a place tag automatically.

## Family members

The Family tab holds everyone: **Mom, Dad, Guardian, Grandma, Grandpa, Sister, Brother, Aunt, Uncle, Cousin, Family friend, Other**,
with an optional wording of your own ("Nana", "Opa") and a profile picture each. There's no limit and nothing assumes one mother
and one father — add as many Moms, Dads or Grandmas as you like. Each member is also a Person tag, and selecting them shows all their memories.

## Share from Google Photos / Gallery

Pick photos or videos in Google Photos or the Gallery → **Share** → **4D Ages**. The import screen opens where you can
confirm the media (remove any), choose what it is (separate photos, Story, Milestone, First or Last), add notes and tags, and save.
The original dates (and times) are kept — read from the photo's EXIF data, a video's recording date, or the date in the file name.
Several at once work. This needs native code: run `npx expo prebuild --platform android` then `npm run android` once.

## Branding

The app is **4D Ages**. Two supplied pictures are the only sources, kept in `branding/`: `4d-ages-icon.jpg` (the app icon artwork)
and `4d-ages-wordmark.png` (the in-app logo, artwork + "4D Ages"). Every image in `assets/` is made from them by
`python3 branding/make-assets.py` (`npm run brand:assets`; needs `pip install pillow numpy scipy`). The pictures are used as they are —
only resized, centred, and (for the in-app logos) with their flat cream backdrop removed. To change the branding, replace those two
files and run the script.

| Image | Used for |
|---|---|
| `assets/icon.png` | the app icon (full bleed, on the picture's own cream) |
| `assets/adaptive-icon.png` | Android adaptive icon: the artwork is *measured* and kept inside Android's strict safe circle (66 dp of 108 = 0.306 of the canvas; the artwork reaches 0.30). It is centred on its visible shape, nudged 30% toward its visual mass (the big D-card on the right makes it feel right-heavy) — see `OPTICAL` in `branding/make-assets.py` |
| `assets/adaptive-icon-monochrome.png` | the **themed-icon glyph** (Android 13+; Pixels tint it with the wallpaper colour) — see "Themed icons" below |
| `assets/splash-icon.png` | the splash screen: the icon, centred, on the same cream as the splash background |
| `assets/logo.png` | the small icon in the app's header (transparent background) |
| `assets/notification-icon.png` | status-bar icon — the same glyph in pure white |
| `assets/4d-ages-wordmark.png` | the in-app logo (transparent): **top-left of every screen**, the welcome screen and the About card |

The splash and loading screens share one cream (`#FEFBF6`, sampled from the icon picture itself), so the hand-over from splash to app
has no seam. The name, version, tagline, cream and logo proportions live in `src/brand.ts`; `npm test` checks them against `app.json`
and against the image files — including the artwork's centring and its fit inside the strict safe circle, measured on the real pixels.

**The app's internal names:** the Android app id is `com.alonc.fourdages` (Android doesn't allow a part of an id to start with a digit, so
`4dages` isn't possible; the same goes for the link scheme, which is `fourdages`) and the saved-data storage key is `4d-ages-v1`. Nobody ever sees either, and neither should change later: a different
app id installs as a second app, and a different storage key hides every saved memory. Installing a new build over this one is an *update*
of the same app — no uninstall, and all memories are kept.

### Themed icons (Pixel and other Android 13+ phones)

With "themed icons" on, the launcher ignores the colour icon and draws the app's **monochrome layer** in one colour taken from the wallpaper,
on a plain tinted circle. From Android 16 QPR2 Pixels do this for every app, and apps cannot opt out: an app *without* a monochrome layer
simply gets a system-made one, so leaving it out would only hand control of the look to Android. The layer therefore has to be good.

The first version just flattened the full-colour illustration. In one tint that became a blob: three cards fused into a slab, the child's head
and arms merged into a cloud, hairline gaps vanished, edges were ragged, and it filled ~90% of the circle. Google's guidance for this layer is
"keep artwork simple; avoid multiple layers and complex shapes", so it is now a purpose-built glyph, made by `branding/make-assets.py` **from the
artwork's own shapes** (the front card with the child, the two back cards, the heart — found in the picture, not redrawn):

- each shape kept whole and smooth; specks and hairlines removed; the child's head separated by a ring of space
- deliberately wide gaps between layers (tightest ≈ 17 px of 1024 ≈ 1.8 dp of the 108 dp icon), so nothing closes up at launcher size
- drawn smaller than the colour icon (reach 0.24 of the canvas; the launcher's circle is 0.333) so it has room to breathe
- pure white with the shape only in the alpha channel — all a launcher reads

`npm test` measures all of this on the real pixels (whole shapes, no specks, minimum gap, breathing room). The knobs are `THEMED_R` and the `GAP_*`
constants in the script. The colour icon is untouched — it is still your picture. To see the glyph on a phone, turn on *Themed icons* in the
wallpaper & style settings, then restart the launcher if it still shows the old icon.

### Applying the name, icon and splash to Android

The icon, splash, scheme and name are Expo settings, so the Android project is regenerated from them rather than edited by hand:

```
npm run setup            # once, if you haven't since the last update
npm run android:sync     # = expo prebuild --platform android --clean (rebuilds android/ from app.json)
npm run android          # builds and installs over the existing app
```
`--clean` deletes and recreates `android/` — nothing in it is kept by hand — so make sure `ANDROID_HOME` is set (it also recreates
`local.properties`). If the launcher still shows the old icon or name for a moment, wait a few seconds or restart the launcher.

## How memories are stored

Everything you add is one kind of record, a **memory**. A memory's `type` is `photo`, `story`, `milestone`, `first`, `last` or `measure`.

| Common to every memory | Only some types |
|---|---|
| `id`, `childId`, `type`, `title`, `description`, `date`, `time`, `location`, `media` (photos & videos), `tagIds`, `createdAt`, `updatedAt` (+ `emoji`, `palette`, `source` for how it's drawn) | `milestoneId` (milestone), `heightCm` / `weightKg` (measure) |

- **One form, one save path.** The "+" form, the photo editor and the share-sheet import all end in the same `saveMemory`.
- **Milestones** are a catalogue (built-in + your own) plus a memory when you log one — there is no separate record or timeline "card".
- **Height and weight** are read from the measurement memories for the charts, the door frame, the recap and the book. Nothing is stored twice.
- **Tags** live once, in a central list: `{ id, name, category: person | event | place | other, relatedFamilyMemberId? }`.
  Memories only hold tag ids, so renaming a person renames their tag everywhere, and finding "Grandma" across every type is an id lookup.

## Your data is protected

- **Migrations.** The saved data has a version (now 5). When an update finds older data it is upgraded in place, step by step
  (v2 firsts → v3 person tags → v4 central tags → v5 one memory list). Nothing is dropped: dates, notes, photos, tags, milestones
  and old heights/weights all carry over (old height/weight entries become measurements, so they now show on the timeline too).
- **Automatic backup.** Before any migration, an untouched copy of the old data is kept under the storage key
  `4d-ages-v1-backup-v<old version>` (never overwritten). The storage key must keep this name, so every phone keeps finding its memories.
- **Photos and videos are files** in the app's own folder; migrations never touch them.
- **Tests.** `npm test` runs the logic tests (migration on realistic old data, tags, sync merge, PDF-free logic) on your computer.

## The home page and your story

- **Home** (🏠) opens on **“<name>'s Story”**, a feed meant for reading, **newest first**. The tools sit beside the title:
  🔍 **search** (words, people, places, tags — or jump to a date) and 🏷 **tags**. Adding photos lives under **+ → Photo or video**.
- **Categories** across the top: Stories, Pictures, Firsts, Lasts, Milestones, Growth. Every post shows its category.
- **Jump to the beginning** scrolls to the oldest post; **Back to the newest** comes back. Search offers **only years, months and
  days that actually have something in them**, and filters the feed to the one you pick.
- The profile boxes open lists: **Photos** (all pictures and videos, no stories), **Milestones** (by name) and **Stories** (stories only).
  The name is the big line; tap the age for the totals; the pen on the picture is the one edit button.

## Pictures and videos in a post

- Several pictures swipe right-to-left in the feed, with dots and a counter, and open in a full-screen gallery you can swipe too.
- When creating or editing a post (stories, firsts, lasts, milestones, measurements **and plain photos**): the first picture is the
  **main picture**; tap one to move it earlier/later, **make it main**, **replace** it, **remove** it, or **add more**.
- Every video gets a thumbnail automatically — including videos you added earlier, which are filled in quietly in the background
  the next time the app opens. **Cover frame** offers three screenshots from the video to choose from.
- Tags and **people can be created on the spot** while creating or editing a post (no trip to the Family tab).

## Watch them grow

- **Videos made for you, by the child's age** — counted from their birthday, not the calendar: since birth to **0–1 month, 0–3 months, 0–6 months,
  0–1 year**, then **every year of age (1–2 years, 2–3 years…)** that has pictures in it. A stretch still in progress says *so far*; a step that
  would show exactly the same pictures as the one before is shown once. Nothing is made until there are a couple of pictures to show.
- **By calendar year** is kept (2026, 2025…). **The section holding the newest video is shown first** (a tie goes to the by-age section).
  There are no monthly summaries any more.
- **Make your own video**: two **sliders** (From and To) run along the child's whole life, one day per step; as you drag, the **date and the
  child's age at that end** show live (and so does the title card: *Here is Maya — at 1–2 years old*). One-day ‹ › nudges give fine control, and
  one-tap starting points offer *Last 30 days*, every age step reached, and *All time*. Then tick the pictures you want, preview, and create.
- **Choose the thumbnail**: when you create a video you pick its **cover** — the picture the video starts with, drawn on the title card (so it is
  also the thumbnail your gallery shows). Without a title card the video starts with its first picture. (Needs a rebuild: it changes the video encoder.)
- (A video clip appears in the movie as its cover frame.) The same picture file never appears twice in one video, and in the exported video the
  old picture holds still while the next fades in over it (`npm test` checks this timing).

## Export file names

Nothing is shared under a random temporary name any more. The baby book is **“Maya Classic Album By 4D-Ages.pdf”** (or *Minimal*, *Storybook*),
and a video is **“Maya 1-2 years Video By 4D-Ages.mp4”** (named by what it shows: *0-6 months*, *2026*, *From day one*, *Year 2*…). Names are cleaned
of anything a file name can't hold (slashes, colons, emoji). The video's name is shown before you create it. If renaming ever fails, the original file is
shared instead, so an export never breaks over a name (`src/lib/fileNames.ts`).

## Siblings are set up for you

When you add a child, they become each other's siblings automatically: the new child is added to every other child's family — **Sister if
their colour is pink, Brother if blue, Sibling if green** — and each existing child is added to the new child's family the same way. It is one
person record per child, so tagging, photos and names stay in step, and **renaming a child (or changing their colour) updates their sibling entry**
unless you changed it by hand. A sibling is never in their own family, and arranging families by hand is never undone. If you already had several
children, **Family → Set up siblings** does the same in one tap. A sibling you had already added by hand (same name, Sister/Brother/Sibling) is
recognised and linked instead of duplicated.

Thumbnails, the icons and the pager need a one-time `npm run setup` and a rebuild (`npm run android`).

## Swiping between tabs

The tabs are a **real horizontal pager** (`react-native-pager-view`), not page-to-page navigation. Every tab is mounted at once, so
when you drag, the next tab is already sitting beside the current one and slides in with your finger; nothing loads or is replaced
when you let go. Each tab keeps its own scroll position and state, and switching tabs never remounts a screen. Tapping the bottom bar
scrolls the same pager. The bar follows the drag too (a sliding indicator, and each tab's highlight fades with the page), and the
area behind the pages has the theme colour so there is no white flash. Chip rows and carousels scroll sideways on their own; the
player's slider locks the pager while you drag it. Needs `npm run setup` (installs the pager libraries) and a rebuild.

## One top bar, one title per tab

The app name and the child switcher live in a single bar **above** the tab pager, so they stay put while the pages slide underneath (who is
selected doesn't change from tab to tab, so neither does the bar). The child's profile card — picture, name, age and the photo /
milestone / story counts — appears on **Home** only; every other tab has a title of its own (Milestones, Growth, Family, Keepsake
book, Bring their moments in) instead of repeating the name and picture. `npm test` guards this (`tests/topbar-layout.test.ts`).

## Design: Material 3

The look follows **Material Design 3**, on the same React Native / Expo framework (no UI library added; nothing else about the app's structure changed).

- **Colour** (`src/lib/m3.ts`, `src/theme.ts`): each child's colour (pink, blue, green) generates a full Material 3 tonal palette — primary, secondary,
  tertiary, error, and the surface-container ladder — at Material's own tones (primary 40, containers 90, text 10, surface 98…). The tokens screens
  already used keep their names and now mean those roles (`bg` = surface, `card` = surface container low, `accent` = primary, `accentSoft` = primary
  container, `chipOn` = secondary container…). `npm test` checks tone accuracy and **WCAG contrast on every text/background pairing, in all three themes**.
- **Shape and components** (`src/components/ui.tsx`): filled / tonal / outlined buttons with Material's disabled states and ripples; an **outlined text
  field** whose outline thickens in the primary colour on focus; a **segmented button**; a **bottom sheet** with 28 dp corners, a drag handle and the standard
  scrim; **filter chips** (selected = tonal container); Material **switches**; outlined date and time fields.
- **Navigation bar**: a tonal bar with a **pill behind the selected icon** that grows as the page arrives, outlined icons that fill in when selected, and
  no divider line. **Top bar**: the 4D Ages wordmark with the children as filter chips. **Profile card**: a rounded tonal card (28 dp).
  **"+" button**: a 56 dp FAB with 18 dp corners; its menu is tonal pills with icons.
- **Type and icons**: Material's type scale on the phone's own font (Roboto) — the serif font is gone, so one font fewer to load — and **Material
  icons** (`@expo/vector-icons`, already installed) in place of emoji and line icons. If an icon name were ever missing from the installed set it shows a
  quiet dot instead of a "?".
- Not included (could be added): Material You **dynamic colour** from the wallpaper, and a dark theme.

## Switching between children is fast

Choosing another child used to (1) rewrite the entire saved-data file, (2) build every post in that child's whole history, and (3) re-render all six
tabs in one blocking pass before the chip even changed. Now:

- **The data file isn't rewritten for a change of child** (`src/lib/dataStorage.ts`): only real changes are saved, exactly as before; the selected child
  lives in its own tiny record. A library of 2,000 memories used to write ~1.4 MB on every switch.
- **The timeline is windowed** (`src/lib/feedWindow.ts`): the newest 20 posts are built first and older ones are added as you scroll toward them
  (or tap *Show older posts*; *Jump to the beginning* loads everything first). A child with 800 posts builds 20 cards, not 800.
- **The chip responds instantly; the page catches up right behind it.** Page content uses a deferred copy of the selected child (React's
  `useDeferredValue`, time-sliced so taps are never blocked); until it's ready the page dims and ignores taps, so nothing can be tapped on the wrong child.
  Everything that *saves* data (sheets, the + button, imports) uses the immediate selection, and a test enforces that.

## A family for each child

Each child has their **own family**. A person is one record that can be in several children's families (Grandma is in both siblings'), so changing her
name or picture changes it everywhere and a tag always means the same person.

- **Adding a second child** pins the existing family to the first child, so the newcomer starts with an *empty* family.
- **Family → Import family from …** (shown whenever another child has people to bring over) opens a window with **everyone already marked**; tap someone
  **once to leave them out** of this child's family (so you don't import a sibling as their own "Brother"); then approve with **Import N people**. With several
  other children you first pick whose family to import from. Someone who looks like a person already there (same name and relationship) is listed but
  not marked. Nothing is copied: importing adds the child to the *same* person.
- **Editing someone** shows **In the family of** (when there is more than one child) to change which children's families they are in.
  Removing a person removes them from every family.
- **If you already had two children** with one shared family, everyone stays shared (nobody disappears); use *In the family of* to separate people.
- The tag picker lists only the selected child's family. Cloud sharing sends and receives each child's own family (`tests/family-flow.test.ts`).

## Sharing keys come from `.env`

Sharing between parents needs only two **public** values: your Supabase project URL and publishable key. Put them in `.env` (template: `.env.example`);
`app.config.js` and `plugins/supabaseEnv.js` find them — by what they are, not what you named them — and hand them to the app at build time, so there is
nothing to paste into code. **A secret key is recognised and skipped (with a warning), and the database connection string is never read.** The app
itself also refuses a secret key. With no URL given, it is worked out from the public project reference in the database connection string.

**`npm run db:setup`** applies `supabase/schema.sql` to your project and checks it (tables, row-level security, functions, the private `media` bucket), using the
connection string in `.env`. It reads that string by hand rather than as a URL, so a password containing `% ? @ # /` works. It runs on your computer
only and never prints the password (`--dry-run` checks the file without connecting). See `SHARING.md`; `tests/supabase-env.test.ts` and
`tests/db-setup.test.ts` cover it.

## Opens where you left off

The app reopens on the **child** you were last viewing and the **tab** you were last on (not always the first child, not always Home). That
is kept in its own tiny record (`4d-ages-resume-v1`: a few bytes, written the instant you switch), separate from the big saved-data file.
On launch the app waits for it before showing anything, selects that child, and jumps (without animating, behind a cover that looks like the
splash) to the saved tab. If that child was removed it falls back to the one the saved data had selected, then the first. Scroll positions are
not restored. A notification tap is acted on **once** and then cleared, because Android can hand the same tap back when the app is restored
from the recents screen — which used to be able to pull you back to that notification's child on every reopen. `npm test` covers all of this
(`tests/resume.test.ts`).

## If adding pictures fails with "unregistered ActivityResultLauncher"

*Attempting to launch an unregistered ActivityResultLauncher … ExponentImagePicker.launchImageLibraryAsync has been rejected* is a known Android/Expo
problem (expo issue #50386, seen on Expo 57). When Android destroys and rebuilds the app's main screen — a change of font size, display size or
language, or memory pressure — Expo's photo picker is left unregistered **until the whole app process restarts**; going to the home screen and back
does not help.

- **Right now:** swipe the app away from your recent apps and open it again. Photos work again, and the app returns to the same child and tab.
- **Prevented:** `plugins/withKeepScreenAlive.js` tells Android the main screen handles font-size, display-size, language and layout-direction changes
  itself, so it is no longer rebuilt for them (applied by `npm run android:sync`, which regenerates `android/` — nothing there is edited by hand).
- **Recovered, if it still happens** (memory pressure can still do it): instead of a console error you get *"The photo picker needs a quick restart"*
  with a **Restart** button that relaunches the app. Every picker in the app goes through one function, so adding photos, profile pictures, family
  pictures and imports are all covered (`tests/picker-restart.test.ts`). Needs a rebuild once (`npm run android:sync`, then `npm run android`).
- In a development build, restarting returns you to the development launcher; in a normal build it reopens the app directly.

## Times are optional

When you add or edit a story, first, last, milestone or photo, no time is asked for. Tap **🕒 ＋ Add time** only if you want one; the
time area then appears (✕ removes it again). A time read from a shared photo is shown pre-filled and can be removed the same way.

## Video export ("Watch them grow" → MP4)

In the Timeline's "Watch them grow" view (and in a Year in review) tap **🎬 Save as video**. Pick the speed
(0.5×–4×, same scale as the player), shape (square / vertical for stories), quality (720p / 1080p) and an optional
title card. The video is made on the phone with a small native module (`modules/video-export`) — crossfades, a slow
zoom, and age + date + caption on every photo. Preview it, slow it down or speed it up, then Share or Save to phone.

This module is native code, so after adding it you must rebuild once: `npm run android`.
Keep the app open while the video is being made. No music track yet.

## Sharing a child with the other parent

Both parents see and add to the same book from their own phones. Set it up once with a free Supabase project — see
**SHARING.md**. Then: profile → *Share with the other parent* → *Invite*, and the other parent taps *Join my partner's baby book*.

## Birthday reminders

Add tab → *Birthday reminders*. A few days before each birthday (1 day / 3 days / 1 week) and on the day, a notification
says the year in review is ready; tapping it opens that recap. Reminders are scheduled on the phone itself, so they work
offline. Use *Send me a test reminder* to check they show up. New native library: rebuild once (`npm run android`).

## Not built yet

Alerts that tell you when the *other* parent adds something (that needs a server to send real push messages), and music for
the video. Photos live on this phone (and in the shared cloud copy, if you turn sharing on) — export the PDF as a backup too.
