# Deploying Kartly to Vercel

This folder is the clean Kartly store (no planted bugs), prepared for Vercel. It was exported from the frozen benchmark app at commit 380dd4f; the benchmark copy in `01_kartly/app` is unchanged.

## What changed from the benchmark app

- `lib/db.ts`: on Vercel the live database is written to `/tmp/kartly` (the deployment folder is read-only). It is created from `data/seed.json` on first use.
- `next.config.mjs`: `data/seed.json` is bundled into every serverless function.
- `.vercelignore`: leaves out the e2e tests and local data.
- Internal build notes were removed.

No bug flags are set, so every `NEXT_PUBLIC_KB_*` switch compiles to "0" (off).

## Deploy (about 5 minutes)

From Terminal on the Mac:

```bash
cd ~/Desktop/Benchmarking/kartly-vercel
npx vercel@latest login        # sign in once in the browser
npx vercel@latest              # first deploy: accept the defaults (framework: Next.js)
npx vercel@latest --prod       # promote to the production URL
```

Or: push this folder to a private GitHub repo and use "Add New Project" in the Vercel dashboard. No environment variables are required.

Optional: set `KARTLY_ALLOW_RESET=1` in Project Settings > Environment Variables to allow `POST /api/dev/reset`.

## Demo accounts

The login page shows the seeded demo accounts in a "Demo accounts" box. All of them use the password `Password@123`.

## Known limits on Vercel

- Data lives in each serverless instance's `/tmp`. Carts, orders and new accounts reset when an instance goes cold, and a second instance does not see the first one's data. A signed-in user who lands on a new instance is signed out.
- This is fine for a click-through demo. For persistent data, run it on a host with a disk (Render, Railway, Fly.io) or move `lib/db.ts` to a hosted store.
