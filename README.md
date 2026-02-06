# th3scr1b3 Base Mini App

A lightweight Base mini app that surfaces "Now Playing" and recent releases from the 365-day project.

## Quick Start

```bash
cd base-mini-app
npm install
npm run dev
```

## Environment

Create a `.env.local` in `base-mini-app/` and set:

```
NEXT_PUBLIC_URL=http://localhost:3000
NEXT_PUBLIC_MAIN_APP_URL=https://th3scr1b3.com
NEXT_PUBLIC_ONCHAINKIT_API_KEY=your_onchainkit_key
NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME=th3scr1b3
NEXT_PUBLIC_ICON_URL=http://localhost:3000/icon.svg
NEXT_PUBLIC_APP_HERO_IMAGE=http://localhost:3000/hero.svg
NEXT_PUBLIC_SPLASH_IMAGE=http://localhost:3000/splash.svg
NEXT_PUBLIC_SPLASH_BG=#0a0a0b
NEXT_PUBLIC_WEBHOOK_URL=http://localhost:3000/api/webhook
NEXT_PUBLIC_FARCASTER_HEADER=
NEXT_PUBLIC_FARCASTER_PAYLOAD=
NEXT_PUBLIC_FARCASTER_SIGNATURE=
```

## Data Source

This mini app reads `public/releases.json` and `public/content-overrides.json`.
A copy is included in `base-mini-app/public/` for both files.
If you update the main dataset, re-copy them into this folder.
