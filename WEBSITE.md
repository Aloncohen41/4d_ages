# The 4D Ages website

The website is the app itself, built for the browser from the same code. Everything you can do in the Android app you can do on the
website, and anything added to the app later comes to the website at the same time.

It's hosted on Cloudflare Pages, built straight from this GitHub repository, with the domain bought at GoDaddy.

## Build it on your computer

```
npm run web          # try it locally at http://localhost:8081
npm run build:web    # the finished site, in dist/
```

`build:web` builds the app for the browser and adds the plain pages beside it (privacy policy, terms, deleting an account, and the invite
link page `/j/`), which are kept in `docs/`.

## Put it online (once)

### 1. Cloudflare Pages

1. In Cloudflare, go to **Workers & Pages → Create → Pages → Connect to Git**, and choose this repository.
2. Build settings:
   - Framework preset: **None**
   - Build command: `npm run build:web`
   - Build output directory: `dist`
   - Environment variable `NODE_VERSION` = `22`
3. Environment variables (Settings → Variables), the same public values as in `.env`:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` (the publishable key)
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

   Never add the secret key, the database connection string or the Google client secret here. The website doesn't need them, and anything
   given to the build ends up in the site.
4. Save and deploy. You get an address like `4d-ages.pages.dev`. Every push to `main` updates the site.

### 2. Your domain (GoDaddy)

1. In Cloudflare, **Add a site** with your domain and choose the free plan. Cloudflare gives you two name servers.
2. In GoDaddy, open the domain → **DNS → Nameservers → Change → Enter my own nameservers**, and paste Cloudflare's two. It can take a few
   hours to switch over.
3. In Cloudflare Pages → your project → **Custom domains**, add the domain (and `www.` if you want it too).

### 3. Sign-in

- **Supabase** → Authentication → URL Configuration: set the **Site URL** to `https://yourdomain`, and add `https://yourdomain/` and
  `https://yourdomain/**` to the **Redirect URLs** (keep `fourdages://auth-callback` there for the app).
- **Supabase** → Authentication → Sign In / Providers → **Google**: it must be turned on, with the web client ID and its secret (the same
  ones the app uses).
- **Google Cloud** → APIs & Services → Credentials → the **web** client: add `https://yourdomain` under *Authorized JavaScript origins*, and
  `https://<your-project>.supabase.co/auth/v1/callback` under *Authorized redirect URIs*.

## How the website differs from the app

- **Photos and videos** you add on the website are kept in that browser and in your account, like on the phone. On another computer they
  come down from your account.
- **Books** open in the browser's print window at their exact size. Choose **Save as PDF** as the printer.
- **Videos** are recorded in the browser as they play, so a two-minute video takes about two minutes to make. Keep the tab open while it
  works.
- **Sharing in**: on a phone, add the website to the home screen (the browser's menu → *Add to Home screen* or *Install app*), and 4D Ages
  appears in the Share menu for photos, videos and recordings, like the app.
- **Reminders and notifications** come from the phone app. A website can't send them when it's closed.
- **Backup to Google Drive** and the **app lock** are in the phone app. On the website everything is already kept in your account, and the
  computer has its own lock.
