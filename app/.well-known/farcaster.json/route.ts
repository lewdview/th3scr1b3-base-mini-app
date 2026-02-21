function readEnv(key: string, fallback = '') {
  const value = process.env[key];
  return value?.trim() || fallback;
}

const appUrl = readEnv('NEXT_PUBLIC_URL', 'http://localhost:3000').replace(/\/+$/, '');

export async function GET() {
  const appConfig = {
    version: '1',
    name: readEnv('NEXT_PUBLIC_FRAME_NAME', 'th3scr1b3'),
    iconUrl: readEnv('NEXT_PUBLIC_ICON_URL', `${appUrl}/icon.png`),
    homeUrl: appUrl,
    imageUrl: readEnv('NEXT_PUBLIC_APP_HERO_IMAGE', `${appUrl}/image.png`),
    buttonTitle: readEnv('NEXT_PUBLIC_FRAME_BUTTON_TITLE', 'Check this out'),
    splashImageUrl: readEnv('NEXT_PUBLIC_SPLASH_IMAGE', `${appUrl}/splash.png`),
    splashBackgroundColor: readEnv('NEXT_PUBLIC_SPLASH_BG', '#eeccff'),
    webhookUrl: readEnv('NEXT_PUBLIC_WEBHOOK_URL', `${appUrl}/api/webhook`),
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
