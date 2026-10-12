# kartly-demo

A locally runnable, Amazon-style e-commerce demo: catalog, search with facets, product pages, guest and user carts, coupons, wishlist, a multi-step checkout with a dummy card and OTP, orders and accounts. Next.js 14.2 (App Router), TypeScript strict, Tailwind CSS, and a single JSON file as the database.

## Setup

Requires Node 18+ and npm.

```bash
npm install
npm run seed      # builds data/seed.json and data/db.json, downloads product images into public/products
npm run dev       # http://localhost:3100 (or $PORT)
```

| Command | What it does |
|---|---|
| `npm run seed` | Builds the catalog from `data/source-products.json` (cached DummyJSON response) and writes `data/seed.json` plus the live `$KARTLY_DATA_DIR/db.json` |
| `npm run dev` | Development server on `$PORT` (default 3100) |
| `npm run build` / `npm start` | Production build / production server on `$PORT` (default 3100) |
| `npm run reset` | Copies `data/seed.json` over `$KARTLY_DATA_DIR/db.json` |
| `npm run test:unit` | Vitest unit tests for the pricing rules (`lib/pricing.test.ts`) |
| `npm run test:e2e` | Playwright acceptance suite (desktop 1440x900 and iPhone 13) |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |

`GET /api/health` returns `{ "ok": true }` once the app is ready.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3100` | Port for `npm run dev` and `npm start` |
| `KARTLY_DATA_DIR` | `./data` | Folder holding the live `db.json`. Run several copies side by side with different values. |
| `KARTLY_ALLOW_RESET` | unset | Set to `1` to enable `POST /api/dev/reset` (and the demo-accounts box) in production |

## Demo accounts

All passwords: `Password@123`. They are also listed on the login page (in development, or when `KARTLY_ALLOW_RESET=1`).

| Email | Seeded state |
|---|---|
| alice@kartly.test | Cart with 3 lines (4 items), 5 wishlist items, 2 addresses, 4 orders (delivered, shipped, cancelled, placed) |
| bob@kartly.test | Empty cart, 1 default address, no orders |
| carol@kartly.test | Cart with an out-of-stock laptop and 5 of a product that has 3 in stock |
| dave@kartly.test | Cart with a bed and `SAVE10` applied, 2 lines saved for later |
| erin@kartly.test | 12 orders across all statuses |
| frank@kartly.test | No addresses, empty cart |
| locked@kartly.test | Locked: sign-in fails with "This account is locked." |

Eight extra customers (`u_c01` to `u_c08`) exist with `@example.com` emails.

## Test cards and OTP

| Card | Result |
|---|---|
| 4242 4242 4242 4242 | Success after OTP |
| 4000 0000 0000 0002 | Declined: "Your card was declined." |
| Any other Luhn-valid card | "This card is not supported in test mode." |

Use any future expiry (MM/YY) and any 3-digit CVV. The OTP is `123456`; three wrong OTPs fail the payment. Card numbers and CVVs are never stored: orders keep only the last 4 digits.

## Coupons

| Code | Effect | Minimum subtotal |
|---|---|---|
| `SAVE10` | 10% off | $50 |
| `FLAT20` | $20 off | $100 |
| `FREESHIP` | Free standard shipping | none |
| `EXPIRED15` | Expired, always rejected | none |

Shipping: standard is free when the discounted subtotal is at least $35, otherwise $5.99; express is $9.99. Tax is 8% of the discounted subtotal. All rules live in `lib/pricing.ts`.

## How the JSON database works

- The live database is `$KARTLY_DATA_DIR/db.json`; `data/seed.json` is the pristine copy and is never written by the app. If `db.json` is missing when the server starts, it is copied from the seed.
- All access goes through `lib/db.ts`: `read()` returns the current snapshot (cached and re-read when the file changes on disk), and `mutate(fn)` runs `fn` on a private copy under an in-process async mutex, then writes `db.json.tmp` and renames it over `db.json` before the API responds. If `fn` throws, nothing is written, so a failed checkout leaves stock and cart untouched.
- Restarting the server keeps all state. Pending payments (between "Place order" and OTP) are held in memory only.

Code map: pricing `lib/pricing.ts`, cart rules `lib/cart.ts`, orders `lib/orders.ts`, payments and OTP `lib/payments.ts`, catalog and search `lib/catalog.ts`.

## Resetting

- `npm run reset` restores `$KARTLY_DATA_DIR/db.json` from `data/seed.json` (works while the server runs).
- `POST /api/dev/reset` does the same and also clears in-memory state (pending payments). It works in development; in production it returns 404 unless `KARTLY_ALLOW_RESET=1`.

## Tests

```bash
npx playwright install chromium
npm run test:e2e                                   # starts `npm run dev` on port 3100 if nothing is running
npm run build && E2E_SERVER=prod npm run test:e2e  # runs against `KARTLY_ALLOW_RESET=1 npm start`
PORT=3101 KARTLY_DATA_DIR=/tmp/k1 E2E_SERVER=prod npm run test:e2e   # another isolated copy
```

The suite runs serially (one shared server) and resets the database before every test. One spec per acceptance flow lives in `e2e/flow-NN-*.spec.ts`; extra specs cover the API rules, PDP, orders and addresses. Every test fails if the browser console logs an error or hydration warning.

## API

Responses are `{ data }` or `{ error: { code, message, fields? } }` with status codes 200, 201, 400, 401, 404, 409 or 422. The Kartly web UI sends the header `x-kartly-client: web`; for that client only, 4xx errors come back as HTTP 200 with the same error envelope plus the real `status`, because browsers log every failed fetch as a console error. All other clients get the real status code.

See `app/api/*` for the full list of endpoints (auth, catalog, cart, coupon, wishlist, addresses, checkout quote/payment/verify-otp, orders, cancel, buy-again, health, dev reset).
