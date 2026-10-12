# Setting up sign-in and sharing

4D Ages uses [Supabase](https://supabase.com) for accounts, the online copy of each book, and sharing between parents and family. This
guide sets up a project from scratch. It takes about ten minutes, and the free plan is enough.

You only need this if you're building the app yourself. Without it, the app still runs, but only on one phone and without sign-in.

## 1. Create a Supabase project

Sign up at supabase.com and create a new project. Choose a database password and keep it somewhere safe, then pick the region
closest to your users. The project takes a minute or two to be ready.

## 2. Create the database

The whole schema (tables, row-level security policies, functions and the private `media` storage bucket) is in `supabase/schema.sql`.
It can be applied as many times as you like, so run it again after any update that changes it.

**With the setup script.** Add the database connection string to `.env` as `SUPABASE_DB_CONNECTION_STRING` (Supabase → **Connect** →
*Session pooler*), then run:

```
npm run db:setup
```

It applies the schema and then checks that every table, policy, function and the storage bucket is in place. It runs on your computer
only and never prints the password. Two options:
- `npm run db:setup -- --dry-run` checks your `.env` without connecting.
- `npm run db:setup -- --try` applies the schema inside a transaction and rolls it back.

If your password contains characters such as `%`, `?`, `@`, `#` or `/`, the connection string would normally need them
percent-encoded. The setup script reads the string itself, so it works either way, but other tools like `psql` won't. The direct connection
(`db.<project>.supabase.co`) needs IPv6. If it can't connect, use the Session pooler string instead.

**By hand.** Open the **SQL Editor** in Supabase, paste in the contents of `supabase/schema.sql` and run it.

## 3. Email sign-in

New accounts confirm their email address, and the link in the email opens the app.

1. **Authentication → Sign In / Providers → Email**: leave **Confirm email** on.
2. **Authentication → URL Configuration → Redirect URLs**: add `fourdages://auth-callback`. Without it, the link in the email opens a web
   page instead of the app. The same link is used for password resets.
3. Optionally, edit the wording under **Authentication → Emails**. Keep the `{{ .ConfirmationURL }}` link.

## 4. Add the keys to `.env`

From **Project Settings → API**, copy the project URL and the publishable key (older projects call it the *anon* key). Put them in
`.env` next to `package.json`:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
```

`app.config.js` passes them to the app at build time. After creating or changing `.env`, restart the development server with
`npx expo start -c`, or rebuild with `npm run android`.

The publishable key is meant to be inside apps: the database policies decide what each user can see. **The secret key and the database
connection string never go in the app.** Don't give them an `EXPO_PUBLIC_` name, because Expo copies those into the build. If a secret
key ends up where the app would read it, the build skips it with a warning, and the app refuses to use it.

## 5. Google sign-in (optional)

"Continue with Google" needs OAuth clients in a Google Cloud project (**APIs & Services → Credentials**):

1. **An Android client** for each signing key, using the package name `com.alonc.fourdages` and that key's SHA-1. Debug builds and
   release builds are signed with different keys, so each needs its own client. The Release workflow prints the release key's SHA-1 on
   the run's summary page. For a local keystore, use `keytool -list -v -keystore <file>`.
2. **A Web application client.** Copy its client ID and client secret.
3. In Supabase, **Authentication → Sign In / Providers → Google**: turn it on, and paste the web client ID and secret.
4. Add the web client ID to `.env`:

   ```
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
   ```

The Google button appears once the client ID is set and the app is rebuilt. The client secret belongs in Supabase only. Don't put it in
`.env` under an `EXPO_PUBLIC_` name, and don't commit the `client_secret_*.json` file Google offers to download.

If Google sign-in fails with `DEVELOPER_ERROR`, the SHA-1 of the key that signed the build doesn't match any Android client.

### Backup to Google Drive

The backup in Settings uses the same Google setup, plus two things in the same Google Cloud project:

1. **APIs & Services → Library → Google Drive API → Enable.**
2. **Google Auth Platform → Data access → Add or remove scopes:** add `.../auth/drive.file` and save. This scope only lets the app see the
   file it creates ("4D Ages backup.zip"), nothing else in the user's Drive, so Google doesn't require a review for it.

If the app's OAuth consent screen is still in **Testing**, only the test users listed there can connect Drive. Publish it (**Audience → Publish
app**) to let anyone use it.

## 6. The website

The `docs/` folder is a small static site, served with GitHub Pages. It has:
- the page a share link opens, which hands the invite code to the app;
- the privacy policy and the terms;
- the account deletion page that Google Play requires.

1. In the repository's **Settings → Pages**, deploy from the `main` branch, `/docs` folder.
2. In Supabase, add the deletion page (`https://<user>.github.io/<repo>/delete-account/`) to the Redirect URLs, so people who signed up with
   Google can sign in there.
3. If the site lives at a different address, update `SITE_URL` in `src/brand.ts` and the links in `docs/`.

The pages use only the publishable key.

## How sharing works

Every child is saved to the account of the parent who added them. From the child's profile, **Share** opens that child's sharing screen:

- **The other parent** gets full access: they see everything and can add to it. A book can have at most two parents.
- **A family member** gets view-only access to the posts tagged with the people you choose. For example, Grandma might see only the posts
  with Grandma and Grandpa in them. Family members can leave one heart and one comment on each post.

Each invite is for one email address, works once, and expires after 7 days. It can be sent by WhatsApp, email or any app, as a link
or a code. The person accepting signs in with their own account. You can remove anyone, block an email address from joining again, or
change what a family member sees.

Changes appear on the other phone within a couple of seconds. The app also syncs when it opens, when you return to it, and every two minutes. If both parents
edit the same item, the newest change wins.

## Limits on the free plan

- About 1 GB of storage and 50 MB per file. Videos over 45 MB stay on the phone that added them.
- A free project pauses after a week without activity. Restore it from the Supabase dashboard.

## Troubleshooting

| Message | What to do |
|---|---|
| "Sign-in isn't set up in this build" | The URL or publishable key wasn't found. Check `.env` (step 4) and restart with `npx expo start -c` |
| "…is a SECRET key, which must never be inside an app" | Use the publishable key instead of the secret key |
| "new row violates row-level security policy" or "permission denied" | The schema is missing or out of date. Run `npm run db:setup` again |
| "Invalid login credentials" | Wrong password, or the account doesn't exist yet |
| "Email not confirmed" | Open the link in the confirmation email, or send it again from the sign-in page |
| The email's link opens a web page | Add `fourdages://auth-callback` to the Redirect URLs (step 3) |
| "That code is invalid or has expired" | Send a new invite |
| `DEVELOPER_ERROR` with Google | Add an Android client for the key that signed this build (step 5) |
