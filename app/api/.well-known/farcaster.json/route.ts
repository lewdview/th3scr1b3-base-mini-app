const appUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

const iconUrl = process.env.NEXT_PUBLIC_ICON_URL || `${appUrl}/icon.svg`;
const heroImageUrl = process.env.NEXT_PUBLIC_APP_HERO_IMAGE || `${appUrl}/hero.svg`;
const splashImageUrl = process.env.NEXT_PUBLIC_SPLASH_IMAGE || `${appUrl}/splash.svg`;
const splashBackgroundColor = process.env.NEXT_PUBLIC_SPLASH_BG || '#0a0a0b';
const webhookUrl = process.env.NEXT_PUBLIC_WEBHOOK_URL || `${appUrl}/api/webhook`;

export async function GET() {
  const domain = appUrl.replace('https://', '').replace('http://', '');

  return Response.json({
    accountAssociation: {
      header: process.env.NEXT_PUBLIC_FARCASTER_HEADER || '',
      payload: process.env.NEXT_PUBLIC_FARCASTER_PAYLOAD || '',
      signature: process.env.NEXT_PUBLIC_FARCASTER_SIGNATURE || '',
    },
    miniapp: {
      version: '1',
      name: 'th3scr1b3',
      subtitle: 'Now Playing',
      description: 'Daily music drops from th3scr1b3, built for Base mini apps.',
      iconUrl,
      homeUrl: appUrl,
      canonicalDomain: domain,
      heroImageUrl,
      splashImageUrl,
      splashBackgroundColor,
      ogTitle: 'th3scr1b3 · Base Mini App',
      ogDescription: 'Now playing and recent releases from the 365-day journey.',
      ogImageUrl: heroImageUrl,
      webhookUrl,
      requiredChains: ['eip155:8453'],
      tags: ['music', 'daily', 'base'],
    },
  });
}
