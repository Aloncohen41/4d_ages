# The 4D Ages website

The website is the app itself, built for the browser from the same code. Everything you can do in the Android app you can do on the
website, and anything added to the app later comes to the website at the same time.

It's hosted on Cloudflare Pages, with the domain bought at GoDaddy. The finished site is published to its own repository (below).

## Build it on your computer

```
npm run web          # try it locally at http://localhost:8081
npm run build:web    # the finished site, in dist/
```

`build:web` builds the app for the browser and adds the plain pages beside it (privacy policy, terms, deleting an account, and the invite
link page `/j/`), which are kept in `docs/`.

## Two repositories

- **4d_ages** (this one) holds all the code: the app and the website are the same code.
- **4d_ages-website** holds only the finished website files. Every push to `main` here builds the website and publishes it there
  (`.github/workflows/website.yml`). Don't edit that repository by hand; it's replaced on each build.

Cloudflare is connected to **4d_ages-website** only, so it never sees the app's code and never has to build anything.

## Put it online (once)

### 1. The website repository

1. On GitHub, create a new repository named `4d_ages-website`. Private is fine. Leave it empty (no README).
2. Make a deploy key, so this repository can publish to it. On your computer:
   ```
   ssh-keygen -t ed25519 -C "4d-ages website" -f website_key -N ""
   ```
   This makes two files: `website_key` (private) and `website_key.pub` (public).
3. In **4d_ages-website** → Settings → Deploy keys → Add deploy key: paste `website_key.pub`, and tick **Allow write access**.
4. In **4d_ages** → Settings → Secrets and variables → Actions:
   - Secrets → New repository secret: `WEBSITE_DEPLOY_KEY`, paste the whole of `website_key` (the private one).
   - Variables → New repository variable: `WEBSITE_REPO` = `Aloncohen41/4d_ages-website`.
   - Variables → New repository variable: `CONTACT_EMAIL` = your support address (shown on the privacy policy, terms and accessibility pages).
5. Delete both key files from your computer. Then in **4d_ages** → Actions → **Website** → Run workflow, and the first build appears in
   **4d_ages-website** a few minutes later.

The website's Supabase and Google settings come from the secrets this repository already has for the app
(`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`): nothing to add.

### 2. Cloudflare Pages

1. In Cloudflare, go to **Workers & Pages → Create → Pages → Connect to Git**, and choose **4d_ages-website**.
2. Build settings: Framework preset **None**, Build command **empty**, Build output directory `/`. No environment variables are needed.
3. Save and deploy. You get an address like `4d-ages.pages.dev`. Every time the website repository changes, the site updates.

### 3. Your domain (GoDaddy)

1. In Cloudflare, **Add a site** with your domain and choose the free plan. Cloudflare gives you two name servers.
2. In GoDaddy, open the domain → **DNS → Nameservers → Change → Enter my own nameservers**, and paste Cloudflare's two. It can take a few
   hours to switch over.
3. In Cloudflare Pages → your project → **Custom domains**, add the domain (and `www.` if you want it too).

### 4. Sign-in

- **Supabase** → Authentication → URL Configuration: set the **Site URL** to `https://yourdomain`, and add `https://yourdomain/` and
  `https://yourdomain/**` to the **Redirect URLs** (keep `fourdages://auth-callback` there for the app).
- **Supabase** → Authentication → Sign In / Providers → **Google**: it must be turned on, with the web client ID and its secret (the same
  ones the app uses).
- **Google Cloud** → APIs & Services → Credentials → the **web** client: add `https://yourdomain` under *Authorized JavaScript origins*, and
  `https://<your-project>.supabase.co/auth/v1/callback` under *Authorized redirect URIs*.

## How the website differs from the app

It does everything the app does. A few things work the way browsers work:

- **Photos and videos** you add on the website are kept in that browser and in your account, like on the phone. On another computer they
  come down from your account.
- **Books** open in the browser's print window at their exact size. Choose **Save as PDF** as the printer.
- **Videos** are recorded in the browser as they play, so a two-minute video takes about two minutes to make. Keep the tab open while it
  works.
- **Sharing in**: on a phone, add the website to the home screen (the browser's menu → *Add to Home screen* or *Install app*), and 4D Ages
  appears in the Share menu for photos, videos and recordings, like the app.
- **Reminders** are the same, shown as the browser's notifications, but only while the website is open (in a tab, or installed on the home
  screen); ones missed earlier that day show when you open it. Reminders when it's closed come from the phone app.
- **The lock** uses the device's own check (Windows Hello, Touch ID or Face ID, a fingerprint or the screen lock).
- **Backup to Google Drive** asks Google in a small window, and the permission lasts about an hour, so the automatic backup runs while it lasts
  and otherwise waits for the next "Back up now".
- **Calendar reminders** for a pet download as a calendar file, which Google Calendar, Outlook and Apple Calendar open.
