# 4D Ages

A baby book for Android, for children and pets. 4D Ages keeps a child's (or a pet's) story in one place: photos and videos, milestones, firsts and lasts, growth, and the
small everyday moments, from pregnancy onwards. Both parents can keep the same book from their own phones, grandparents can follow
along, and the whole thing can be turned into a printed keepsake book or a short video at any time.

The latest APK is on the [Releases](https://github.com/Aloncohen41/4d_ages/releases/latest) page.

## Features

**The story**
- A feed for each child, newest first, grouped by age. Posts can be photos and videos, stories, milestones, firsts, lasts, measurements
  or voice notes.
- Tags for people, places and events, with search by word, person, place or date.
- Photos and videos keep the date they were taken, read from the file.
- "On this day" brings back memories from the same date in earlier years.

**Milestones**
- A checklist based on ZERO TO THREE's *Developmental Milestones by Age* (birth to 36 months), across social and emotional, language,
  cognitive and movement development.
- Milestones are never shown as late or behind. A Reinforce page suggests simple activities for an area that could use a little extra play.
- Firsts and lasts, with ideas to choose from.

**Growth**
- Height, weight and head circumference, with percentiles from the WHO or CDC charts, and comparisons from a banana to a grown-up ("As tall as 125 pancakes, stacked").
- A growth chart with percentile lines, a door-frame view and "as tall as" comparisons.
- Metric or imperial units.

**Pregnancy**
- A due date in the future starts a pregnancy profile. Posts show the week and the baby's size, for example "Week 20 (banana)", with a photo of that fruit or vegetable.
- Pregnancy milestones by trimester, including a gender reveal.
- Symptoms (with how long they lasted) and cravings. Common symptoms come with tips based on the NHS pregnancy pages; the tips are never saved into the book.
- Ultrasound pictures and scan measurements.
- A weekly bump photo with tips for consistent shots. The photos play back as a video of the bump growing.
- "Welcome to the world" sets the birth date and turns the pregnancy into the child's own profile, with a guided birth story that gets its own pages in the book.
- A child who is already born can have their pregnancy added afterwards, and the book can include or leave out the pregnancy.

**Pets**
- Dogs, cats, rabbits, birds, hamsters, snakes and horses get a book of their own: where they came from (with a map), their age in their own years, tricks and firsts, and the day they came home.
- Health: vet visits, vaccinations, treatments and their details, with reminders as notifications or calendar events, and their weight with fun comparisons ("As heavy as 5 watermelons").
- Stories: their tricks and firsts, and their adventures: every place they've been on a map, played back year by year (also as a video), their pack and favourite things.
- Four pet book themes, and a book "In loving memory" when the time comes.

**Keepsake book and videos**
- A PDF book in date order ("Maya's Days", then "Maya's Years" from age two), with chapters by age and eight themes.
- The book can be previewed page by page, saved to the phone or shared.
- Pictures with a brother, a sister or a pet get pages of their own in the book.
- Videos made automatically by age and by year, suggested from big days, trips, birthdays and busy months, or picked by hand. Four looks (Classic, Story, Snapshots, Journal), public domain music, cards of words from your stories, and only your child or with family. Video clips play in them with their sound (up to 30 seconds each, and you choose which 30).
- Classics pages for the traditional baby-book entries: teeth, the birth story, first haircut and monthly photos.

**Family and sharing**
- Family members for each child, who double as tags, with who they are to the child and whose side of the family they're on. The book's family tree shows each parent's side on its own half.
- Siblings are linked automatically.
- Share photos, videos and sound recordings from any app straight into a profile, as a post, a story, a first, a milestone, a voice note and more.
- A child's book can be shared with the other parent (full access, at most two parents) and with family members. Family members
  can view only the posts with the people you choose, and can leave one heart and one comment per post.
- Invites are made for one email address and expire after 7 days. Anyone with access can be removed or blocked.

**Everything else**
- A health log for check-ups, vaccinations, illnesses and medicines.
- Reminders for birthdays, monthly milestones, the monthly photo and the weekly bump photo.
- App lock with fingerprint or face unlock, and light, dark or system theme.
- Dates are always written day first.
- More than one account can be used on the same phone; each account's books are kept separately.
- Optional backup to the user's own Google Drive: one small file with the books, updated after each change, with restore. Photos come back from the account.
- The app checks for a newer version when it opens.

## How it works

The app is local-first. Everything is saved on the phone and works offline. Signing in (email or Google) adds a private online copy
through [Supabase](https://supabase.com), so a new phone gets the books back and a shared book stays in step between phones. Changes
arrive within a couple of seconds through Supabase Realtime.

Access is enforced by the database (row-level security), not just by the app. Pictures are kept in a private storage bucket. The app
never scans photos or creates face data: every picture in the book is one you chose.

A build without Supabase configured still runs, but only on that phone and without sign-in or sharing.

## Tech stack

- [Expo](https://expo.dev) SDK 57, React Native and TypeScript, with expo-router for navigation
- Zustand for state, persisted with AsyncStorage
- Supabase for authentication, Postgres, storage and realtime
- Material 3 colour, shape and type, with a tonal palette generated from each child's colour
- Three small native modules of our own in `modules/`: MP4 export, receiving shared photos from other apps, and saving or sharing finished files through Android
- expo-print for the PDF book
- [OpenStreetMap](https://www.openstreetmap.org) for maps and place search (Leaflet in a web view, and Nominatim), so no map key is needed; the world map picture is drawn from Natural Earth (public domain)

## Getting started

You need Node.js 24, JDK 17, the Android SDK (with `ANDROID_HOME` set) and an Android phone with USB debugging on. On Windows, keep
the project in a short path such as `C:\dev\4d-ages`, since Gradle can fail on long paths.

```
npm install
npm run setup          # installs the Expo libraries at the versions that match SDK 57
npm run android:sync   # generates the android/ project from app.json
npm run android        # builds a development app and installs it on the phone
```

The first build takes a while. After that, `npm start` is all you need day to day.

`npm run setup` is required: `npm install` alone leaves out the Expo libraries. A setup check runs before `npm start` and
`npm run android` and tells you what's missing; you can also run it with `npm run check`. `npm run doctor` runs Expo's own checks.

`android/` is generated and isn't kept in git. Run `npm run android:sync` again after changing `app.json`, the icons or the config plugins.

## Configuration

Sign-in and sharing need a Supabase project. [SHARING.md](SHARING.md) walks through setting one up, including the database schema,
email settings, Google sign-in and the website.

The app reads its settings from `.env` at build time (copy `.env.example` to start):

| Variable | |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | The project's publishable (anon) key |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Optional. Shows "Continue with Google" |
| `SUPABASE_DB_CONNECTION_STRING` | Optional, for `npm run db:setup` only. Never included in the app |

Only the publishable key belongs in the app. The build ignores a secret key if it finds one, and the app refuses to use it.

## Project structure

```
app/                 Screens (expo-router). app/(tabs) holds Home, Milestones, Growth and Book
src/components/      UI components and sheets
src/lib/             App logic: the store, sync, dates, growth, the book and video builders, reminders
src/data/            Static data such as the emoji list
modules/             Native modules: video-export, share-intake and file-export
plugins/             Expo config plugins
supabase/schema.sql  Database tables, row-level security policies and functions
public/              The website's own files: share link page, privacy policy, terms, accessibility, licences, account deletion
docs/                Forwarding pages for the old GitHub Pages address (old links go on to 4dages.com)
branding/            Source artwork for the icon and wordmark, and the scripts that build assets/ from it
scripts/             Setup check, database setup, version bump, signing key
tests/               Tests, run with npm test
```

## Testing

```
npm test             # all tests
npm run typecheck    # TypeScript
```

The tests run with Node and don't need a phone or emulator. They cover the app's logic, such as data migrations, sync merging,
percentiles, the book layout, sharing rules, reminders and pregnancy weeks, and check that the brand assets and config agree.

CI runs the setup check, the type check and the tests on every push and pull request.

## Releases

Releases are built and signed by GitHub Actions (`.github/workflows/release.yml`) when a version tag is pushed. The APK is attached to a
GitHub Release with its SHA-256, and the release notes come from that version's section in [CHANGELOG.md](CHANGELOG.md).

**One-time setup:** create the signing key and add it to the repository secrets, along with the Supabase values:

```
npm run signing:key                      # writes release.keystore and github-secrets.env to ~/4d-ages-signing
gh secret set -f ~/4d-ages-signing/github-secrets.env
gh secret set EXPO_PUBLIC_SUPABASE_URL
gh secret set EXPO_PUBLIC_SUPABASE_ANON_KEY
gh secret set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID   # optional
```

Back up the keystore somewhere safe. Android only installs an update signed with the same key, so losing it means everyone has to
uninstall and reinstall.

**Each release:**

1. Add a section for the new version to `CHANGELOG.md`.
2. `make bump` (or `npm run release:bump -- patch`) to update the version in `app.json`, `src/brand.ts`, `package.json` and `package-lock.json`.
3. `make release` to run the tests, commit, tag `v<version>` and push.

Without `make`, commit the version change yourself, then `git tag v1.2.3 && git push origin main v1.2.3`.
The Android `versionCode` comes from the workflow run number, so it always goes up.

Running the Release workflow by hand from the Actions tab builds the APK as a downloadable artifact without publishing it.

**Values that must never change:** the Android application id `com.alonc.fourdages` and the local storage key `4d-ages-v1`. A new
application id installs as a separate app, and a new storage key would hide every saved memory. When the saved data format changes,
`src/lib/migrate.ts` upgrades it in place and keeps a backup of the old data first.

## Branding

The icon and wordmark come from two source images in `branding/`. Every image in `assets/` is generated from them:

```
npm run brand:assets      # needs Python with pillow, numpy and scipy
npm run brand:wordmarks
```

This includes the Android adaptive icon and the monochrome glyph used for themed icons on Android 13 and later. The tests check the
generated images against the safe areas Android expects.

## Troubleshooting

**Adding photos fails with "unregistered ActivityResultLauncher".** This is an Expo bug on Android: when the system recreates the app's
screen (after a change of font size, display size or language, or under memory pressure), the photo picker stops working until the
app restarts. Swipe the app away from recent apps and open it again. The app also shows a Restart button when this happens, and
`plugins/withKeepScreenAlive.js` stops Android recreating the screen for most of these changes.

**`npm install` fails with ERESOLVE.** The repository's `.npmrc` handles the React peer-dependency conflict. Make sure you're running
npm from the project folder so it's picked up.

**The old icon or name still shows after a rebuild.** Run `npm run android:sync`, reinstall, and restart the launcher if needed.

For sign-in and sharing problems, see the table at the end of [SHARING.md](SHARING.md).

## Feedback

Questions, feedback and privacy requests: [contact@4dages.com](mailto:contact@4dages.com). Bug reports and suggestions are also welcome in [Issues](https://github.com/Aloncohen41/4d_ages/issues).
