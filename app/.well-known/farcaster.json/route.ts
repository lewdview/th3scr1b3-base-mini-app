function readEnv(key: string, fallback = '') {
  const value = process.env[key];
  return value?.trim() || fallback;
}

const appUrl = readEnv('NEXT_PUBLIC_URL', 'http://localhost:3000').replace(/\/+$/, '');

const appName = readEnv('NEXT_PUBLIC_FRAME_NAME', 'th3scr1b3');
const subtitle = readEnv('NEXT_PUBLIC_FRAME_SUBTITLE', '365 Days of Light and Dark');
const description = readEnv(
  'NEXT_PUBLIC_FRAME_DESCRIPTION',
  'Daily music drops from th3scr1b3, built for Base mini apps.'
);
const buttonTitle = readEnv('NEXT_PUBLIC_FRAME_BUTTON_TITLE', 'Check this out');

const iconUrl = readEnv('NEXT_PUBLIC_ICON_URL', `${appUrl}/icon.png`);
const imageUrl = readEnv('NEXT_PUBLIC_APP_HERO_IMAGE', `${appUrl}/image.png`);
const splashImageUrl = readEnv('NEXT_PUBLIC_SPLASH_IMAGE', `${appUrl}/splash.png`);
const splashBackgroundColor = readEnv('NEXT_PUBLIC_SPLASH_BG', '#eeccff');
const webhookUrl = readEnv('NEXT_PUBLIC_WEBHOOK_URL', `${appUrl}/api/webhook`);

export async function GET() {
  const domain = appUrl.replace('https://', '').replace('http://', '');

  return Response.json({
    accountAssociation: {
      header: readEnv('NEXT_PUBLIC_FARCASTER_HEADER'),
      payload: readEnv('NEXT_PUBLIC_FARCASTER_PAYLOAD'),
      signature: readEnv('NEXT_PUBLIC_FARCASTER_SIGNATURE'),
    },
    frame: {
      version: '1',
      name: appName,
      iconUrl,
      homeUrl: appUrl,
      imageUrl,
      buttonTitle,
      splashImageUrl,
      splashBackgroundColor,
      webhookUrl,
    },
    miniapp: {
      version: '1',
      name: appName,
      subtitle,
      description,
      iconUrl,
      homeUrl: appUrl,
      canonicalDomain: domain,
      heroImageUrl: imageUrl,
      splashImageUrl,
      splashBackgroundColor,
      ogTitle: `${appName} · Base Mini App`,
      ogDescription: description,
      ogImageUrl: imageUrl,
      webhookUrl,
      requiredChains: ['eip155:8453'],
      tags: ['music', 'daily', 'base'],
    },
  });
}
