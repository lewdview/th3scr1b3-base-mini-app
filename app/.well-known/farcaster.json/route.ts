function readEnv(key: string, fallback = '') {
  const value = process.env[key];
  return value?.trim() || fallback;
}

function readList(key: string, fallback: string[]) {
  const value = readEnv(key);
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const appUrl = readEnv('NEXT_PUBLIC_URL', 'http://localhost:3000').replace(/\/+$/, '');
const domain = appUrl.replace(/^https?:\/\//, '');

function resolveCastShareUrl(baseUrl: string) {
  const configured = readEnv('NEXT_PUBLIC_FRAME_CAST_SHARE_URL', baseUrl);
  try {
    const base = new URL(baseUrl);
    const candidate = new URL(configured);
    return candidate.host === base.host ? configured : baseUrl;
  } catch {
    return baseUrl;
  }
}

export async function GET() {
  const imageUrl = readEnv('NEXT_PUBLIC_APP_HERO_IMAGE', `${appUrl}/image.png`);
  const splashImageUrl = readEnv('NEXT_PUBLIC_SPLASH_IMAGE', `${appUrl}/splash.png`);
  const castShareUrl = resolveCastShareUrl(appUrl);

  const appConfig = {
    version: '1',
    name: readEnv('NEXT_PUBLIC_FRAME_NAME', '365 Days of Light and Dark'),
    subtitle: readEnv('NEXT_PUBLIC_FRAME_SUBTITLE', 'by th3scr1b3'),
    description: readEnv(
      'NEXT_PUBLIC_FRAME_DESCRIPTION',
      'Listen, collect, and share daily releases by th3scr1b3 on Base.'
    ),
    iconUrl: readEnv('NEXT_PUBLIC_ICON_URL', `${appUrl}/icon.png`),
    homeUrl: appUrl,
    imageUrl,
    buttonTitle: readEnv('NEXT_PUBLIC_FRAME_BUTTON_TITLE', 'Check this out'),
    splashImageUrl,
    splashBackgroundColor: readEnv('NEXT_PUBLIC_SPLASH_BG', '#eeccff'),
    webhookUrl: readEnv('NEXT_PUBLIC_WEBHOOK_URL', `${appUrl}/api/webhook`),
    screenshotUrls: readList('NEXT_PUBLIC_FRAME_SCREENSHOT_URLS', [
      `${appUrl}/screenshot-1.png`,
      `${appUrl}/screenshot-2.png`,
    ]),
    primaryCategory: readEnv('NEXT_PUBLIC_FRAME_PRIMARY_CATEGORY', 'music'),
    tags: readList('NEXT_PUBLIC_FRAME_TAGS', ['music', 'dailydrops', 'poetry', 'base', 'nft']),
    heroImageUrl: readEnv('NEXT_PUBLIC_FRAME_HERO_IMAGE_URL', imageUrl),
    tagline: readEnv('NEXT_PUBLIC_FRAME_TAGLINE', 'Daily drops by th3scr1b3'),
    ogTitle: readEnv('NEXT_PUBLIC_FRAME_OG_TITLE', '365 Days of Light and Dark'),
    ogDescription: readEnv(
      'NEXT_PUBLIC_FRAME_OG_DESCRIPTION',
      'A new release every day across light and dark moods.'
    ),
    ogImageUrl: readEnv('NEXT_PUBLIC_FRAME_OG_IMAGE_URL', imageUrl),
    castShareUrl,
    canonicalDomain: domain,
    requiredChains: ['eip155:8453'],
  };

  return Response.json({
    accountAssociation: {
      header: readEnv('NEXT_PUBLIC_FARCASTER_HEADER'),
      payload: readEnv('NEXT_PUBLIC_FARCASTER_PAYLOAD'),
      signature: readEnv('NEXT_PUBLIC_FARCASTER_SIGNATURE'),
    },
    frame: appConfig,
    miniapp: appConfig,
  });
}
