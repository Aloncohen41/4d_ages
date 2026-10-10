# Turn on sharing between parents (about 10 minutes, free)

Sharing keeps one private copy of your child's book online, so you and the other parent both see — and add to — the
same photos, milestones and heights, each from your own phone. It uses **Supabase** (a free online database).
You only do this once; the other parent just installs the app and enters a code.

## 1. Create the project

1. Go to **supabase.com** → *Start your project* → sign up (free).
2. **New project** → give it a name (e.g. *4d-ages*), choose a **database password** (save it somewhere), pick the
   region closest to you → *Create*. Wait ~2 minutes until it says it's ready.

## 2. Create the tables and privacy rules

**Option A — one command (uses the database connection string in your `.env`):**

```
npm install
npm run db:setup
```

It applies `supabase/schema.sql`, then checks that the tables, the privacy rules, the sharing functions and the private `media` bucket are all there,
and says so with ✓ marks. (`npm run db:setup -- --dry-run` checks your `.env` without connecting.) It runs on your computer only: the app never sees
the connection string, and the password is never printed. Running it twice is harmless.

> **If your connection string "doesn't work":** Supabase passwords can contain characters like `%` `?` `@` `#` `/`. In a connection string those
> must be percent-encoded, and a string that has them written plainly can't be read as a normal URL (a tool reads the *user name* as the host).
> `db:setup` reads the string itself, so it copes with that. Other tools (such as `psql`) won't, so for them reset the password to letters and numbers only.
> The direct connection (`db.<project>.supabase.co`) needs IPv6, which some networks lack; if it can't connect, use the **Session pooler** string
> from Supabase → **Connect** (that's the form with `….pooler.supabase.com`).

**Option B — no tools needed:**

1. In the left menu open **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this project, copy **everything**, paste it in, press **Run**.
3. You should see *Success. No rows returned.* (Running it twice is harmless.)

## 3. Make sign-up simple

**Authentication → Sign In / Providers → Email** → turn **off** “Confirm email” → Save.
(If you leave it on, new users must tap a link in an email before they can sign in.)

## 4. Put your two public values in `.env`

**Project Settings → API** (or *API Keys*) has the two values the app needs:

- **Project URL** (`https://….supabase.co`)
- **anon / public key** (newer projects call it the *publishable* key, `sb_publishable_…`)

Put them in a file called `.env` next to `package.json` (copy `.env.example` to start):

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
```

You don't edit any code. The build finds the two values and hands them to the app. Other variable names work too: it takes the project URL
(recognised by its shape) and any variable with `SUPABASE` in its name that holds a **publishable** key. If there is no URL at all, it is worked out from
the **project reference** in your database connection string (only that public reference is used, never the password).

> **The secret key and the database connection string never go in the app.** Keep them in `.env` if you like (for your own tools), but
> don't give them an `EXPO_PUBLIC_` name (Expo copies those into the app). If a secret key is ever found, the build ignores it and says so,
> and the app itself refuses to use one. The anon/publishable key is designed to live in apps: the rules from step 2 make sure each
> family can only see its own data.

After you create or change `.env`, restart the development server with `npx expo start -c` (or run `npm run android` again).

## 4b. Optional: "Continue with Google"

Parents can sign in with their Google account instead of an email and password. It needs three things in the Google Cloud project
**d-ages** (**APIs & Services → Credentials**) and one switch in Supabase:

1. **An Android OAuth client** (done): package name `com.alonc.fourdages` and the SHA-1 of the key that signs the app. Its client ID is
   `374884084370-5k2g584ndqcp09kbig9mm4af1thg6am2.apps.googleusercontent.com`. The app doesn't use this ID; Google uses the client to
   recognise the app. Debug builds use the debug key's SHA-1 (`5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`);
   **release builds need a second Android client with the release key's SHA-1**. Every run of the Release workflow shows it on the run's
   summary page ("Signing certificate (SHA-1 …)"); or run `keytool -list -v -keystore release.keystore` where you keep the key.
2. **A Web application OAuth client** (Create credentials → OAuth client ID → Web application; no URLs needed). Copy its **client ID**
   and **client secret**.
3. **Supabase → Authentication → Sign In / Providers → Google**: turn it on, paste the **web** client ID and secret, and save.
4. **`.env`**: add the web client ID (it's public, like the publishable key; the secret stays in Supabase only):

   ```
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
   ```

The **Continue with Google** button appears in the sign-in card once that line is in `.env` and the app is rebuilt. Without it, email sign-in
works as before. Never commit the `client_secret_….json` file Google lets you download: `.gitignore` keeps it out.

## 5. Rebuild once

```
npm install        # adds the Supabase libraries
npm run setup      # adds expo-notifications at the right version
npm run android    # rebuilds the app on your phone
```

## 6. Use it

**Parent 1:** a child's profile (tap their picture) → **Share with the other parent** → create an account →
**Share {name}** (uploads everything; the first time can take a few minutes) → **Invite the other parent** → send the code.

**Parent 2:** install the app → **Join my partner's baby book** → create *their own* account → enter the code.
The child appears on their phone and everything downloads. From then on both phones sync by themselves: when you open the
app, when you come back to it, every 2 minutes, and a few seconds after any change.

## Good to know

- **Free plan limits:** about 1 GB of storage and 50 MB per file (videos over 45 MB stay on the phone that took them).
  A free project **pauses after a week with no activity** — if that ever happens, press *Restore* in the Supabase dashboard.
- **Who can see what:** only people you invite. Pictures are in a private bucket (not public links). Each invite code works
  once and expires after 7 days.
- **Both edit at once?** The newest change wins, per item (per photo, per milestone…). Deleting something on one phone
  removes it on the other.
- **Forgot a password?** Reset it from Supabase → Authentication → Users.

## If something goes wrong

| Message | Fix |
|---|---|
| “One-time setup needed” in the app | The URL and publishable key weren't found in `.env` — see step 4, then restart with `npx expo start -c` |
| “…is a SECRET key, which must never be inside an app” | The key found is a secret key. Use the **publishable / anon** key instead (step 4) |
| “new row violates row-level security policy” / “permission denied” | The SQL from step 2 wasn't run (or failed) — run `schema.sql` again |
| “Invalid login credentials” | Wrong password, or the account wasn't created yet |
| “Email not confirmed” | Turn off *Confirm email* (step 3) or tap the link in the email |
| “That code is invalid or has expired” | Make a fresh code on the first phone |
