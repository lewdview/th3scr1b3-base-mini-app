# th3scr1b3 Base Mini App

A lightweight Base mini app that surfaces "Now Playing" and recent releases from the 365-day project.

## Quick Start

```bash
cd th3scr1b3-base-mini-app
npm install
npm run dev
```

## Environment

Create a `.env.local` in `th3scr1b3-base-mini-app/` and set:

```bash
NEXT_PUBLIC_URL=http://localhost:3000
NEXT_PUBLIC_MAIN_APP_URL=https://th3scr1b3.art
NEXT_PUBLIC_ONCHAINKIT_API_KEY=
NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME=th3scr1b3
NEXT_PUBLIC_DAILY_MUSE_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_MINT_PRICE_ETH=0.001
NEXT_PUBLIC_RELEASE_STORAGE_BASE_URL=https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready
NEXT_PUBLIC_ICON_URL=http://localhost:3000/icon.png
NEXT_PUBLIC_APP_HERO_IMAGE=http://localhost:3000/image.png
NEXT_PUBLIC_SPLASH_IMAGE=http://localhost:3000/splash.png
NEXT_PUBLIC_SPLASH_BG=#eeccff
NEXT_PUBLIC_WEBHOOK_URL=http://localhost:3000/api/webhook
NEXT_PUBLIC_FARCASTER_HEADER=
NEXT_PUBLIC_FARCASTER_PAYLOAD=
NEXT_PUBLIC_FARCASTER_SIGNATURE=
```

## Data Source (Definitive)

This mini app now uses only:

- `public/release-manifest.json` (authoritative release order and storage paths)
- `public/content-overrides.json` (day-specific title/info/video overrides)

It no longer depends on `public/releases.json` or `public/releases.local.json`.

## Sync From Main App

From the main app repo (`th3scr1b3-365-warp`), run:

```bash
npm run mini:sync
```

This copies the two definitive source files into this mini app's `public/` directory.

## Archive

Legacy release JSON files and scripts were moved to `old_nfo/`.
