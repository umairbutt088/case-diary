# Case Diary — Marketing Website

Full product landing site for **Case Diary for Lawyers** (separate from the GitHub Pages support/legal docs).

## Local development

```bash
cd website
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Production build

```bash
cd website
npm run build
```

Output is in `website/dist/`.

## Deploy to Vercel

1. Push this repo (or the `website/` folder) to GitHub.
2. In [Vercel](https://vercel.com): **Add New Project** → import the repo.
3. Set:
   - **Root Directory:** `website`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Deploy. You get a URL like `https://casediary.vercel.app`.
5. Optional: attach a custom domain in Vercel → Project → Settings → Domains.

`vercel.json` is included for SPA-style routing.

## Deploy to Netlify

- Base directory: `website`
- Build: `npm run build`
- Publish: `dist`

## App Store buttons

Both store buttons are live in [`index.html`](index.html) / [`src/main.js`](src/main.js):

- Google Play: `https://play.google.com/store/apps/details?id=com.umairbutt.legaldiary`
- App Store: `https://apps.apple.com/app/case-diary-for-lawyers/id6786853969`

Rebuild and redeploy after changes.

## Legal / support links

Footer links to the existing GitHub Pages support site (unchanged):

- Support: https://umairbutt088.github.io/case-diary/
- Privacy / Terms / Delete account: same host
- Email: info@devorium.com
