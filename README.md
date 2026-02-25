# th3scr1b3 Base Mini App

Base + Farcaster mini app for the **365 Days of Light and Dark** project.

- Production mini app: `https://base.th3scr1b3.art`
- Main experience: `https://th3scr1b3.art`

## Current App Capabilities

- Loads daily releases from `release-manifest.json` + `content-overrides.json`.
- Shows a "Now Playing" hero for the latest available day and a full release grid.
- Streams audio from storage URLs and shows a global bottom player with seek + elapsed/total time.
- Resolves cover art from `covers/.../*.png` paths; falls back to generated mood art if missing.
- Supports wallet connect in-frame (OnchainKit MiniKit + wagmi on Base).
- Supports per-track onchain minting (`mintingOpen`, `getPrice`, then `mint`).
- Supports ETH donations with preset amounts + custom amount.
- Supports track details page at `/track/[day]` (open by long-pressing a card).
- Supports paid comments on track pages (comment requires ETH tx; tx hash is displayed).
- Serves Farcaster manifest JSON from:
  - `/.well-known/farcaster.json`
  - `/api/.well-known/farcaster.json`
- Serves token metadata at `/api/metadata/[id]`.

## Known Behavior / Limits

- Comments are currently stored in browser `localStorage` (`th3scr1b3_paid_comments_v1`), so they are not shared across users/devices yet.
- Tracks are shown only when their computed date is on or before "today".

## Route Map

- `/` - main feed, playback, mint, donation
- `/track/[day]` - track detail, mint details, paid comments
- `/.well-known/farcaster.json` - Farcaster manifest
- `/api/.well-known/farcaster.json` - Farcaster manifest (API alias)
- `/api/metadata/[id]` - NFT metadata JSON by token/day id
- `/api/webhook` - webhook health endpoint (`GET`/`POST` returns `{ ok: true }`)

## Data Sources (Definitive)

Only these files drive release content:

- `public/release-manifest.json`
- `public/content-overrides.json`

Release building logic lives in `app/lib/release-data.ts`:

- Derives absolute day number from `month + index`.
- Builds audio URL from explicit `audioPath` or inferred fallback.
- Builds cover URL from explicit `coverPath` or inferred `covers/... .png`.
- Resolves mood in order: override -> manifest -> inferred text -> database map -> legacy map -> day parity fallback.
- Uses `app/lib/day-durations.ts` for displayed track durations.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Copy `.env.local.example` to `.env.local` and set values.

### Core

```bash
NEXT_PUBLIC_URL=http://localhost:3000
NEXT_PUBLIC_ONCHAINKIT_API_KEY=
NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME=th3scr1b3
NEXT_PUBLIC_DAILY_MUSE_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_MINT_PRICE_ETH=0.001
NEXT_PUBLIC_RELEASE_STORAGE_BASE_URL=https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready
```

### Donations + Comments

```bash
NEXT_PUBLIC_DONATION_ADDRESS=0x985606Faaad78887Df96002a3555ccf2c8640a08
NEXT_PUBLIC_DONATION_LABEL=th3scr1b3.eth
NEXT_PUBLIC_DONATION_PRESETS=0.001,0.005,0.01
NEXT_PUBLIC_COMMENT_RECEIVER=0x985606Faaad78887Df96002a3555ccf2c8640a08
NEXT_PUBLIC_COMMENT_FEE_ETH=0.0002
```

### Farcaster / Branding

```bash
NEXT_PUBLIC_ICON_URL=http://localhost:3000/icon.png
NEXT_PUBLIC_APP_HERO_IMAGE=http://localhost:3000/image.png
NEXT_PUBLIC_SPLASH_IMAGE=http://localhost:3000/splash.png
NEXT_PUBLIC_SPLASH_BG=#eeccff
NEXT_PUBLIC_WEBHOOK_URL=http://localhost:3000/api/webhook
NEXT_PUBLIC_FARCASTER_HEADER=
NEXT_PUBLIC_FARCASTER_PAYLOAD=
NEXT_PUBLIC_FARCASTER_SIGNATURE=
```

Optional advanced frame keys are also supported in code:
`NEXT_PUBLIC_FRAME_NAME`, `NEXT_PUBLIC_FRAME_SUBTITLE`, `NEXT_PUBLIC_FRAME_DESCRIPTION`,
`NEXT_PUBLIC_FRAME_BUTTON_TITLE`, `NEXT_PUBLIC_FRAME_SCREENSHOT_URLS`,
`NEXT_PUBLIC_FRAME_PRIMARY_CATEGORY`, `NEXT_PUBLIC_FRAME_TAGS`,
`NEXT_PUBLIC_FRAME_HERO_IMAGE_URL`, `NEXT_PUBLIC_FRAME_OG_TITLE`,
`NEXT_PUBLIC_FRAME_OG_DESCRIPTION`, `NEXT_PUBLIC_FRAME_OG_IMAGE_URL`,
`NEXT_PUBLIC_FRAME_CAST_SHARE_URL`, `NEXT_PUBLIC_FRAME_TAGLINE`.

`NEXT_PUBLIC_MAIN_APP_URL` remains in `.env.local.example` for compatibility but is not currently used by runtime code.

## Build / Deploy

```bash
npm run build
```

Deploys target Vercel; production domain is `base.th3scr1b3.art`.

## Archive

Legacy release JSON files and scripts are kept in `old_nfo/`.
