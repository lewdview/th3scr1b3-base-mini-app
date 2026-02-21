import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'th3scr1b3 · Base Mini App',
  description: 'Now playing and recent releases from th3scr1b3, inside Base.',
};

function readEnv(key: string, fallback = '') {
  const value = process.env[key];
  return value?.trim() || fallback;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const appUrl = readEnv('NEXT_PUBLIC_URL', 'https://base.th3scr1b3.art').replace(/\/+$/, '');
  const appName = readEnv('NEXT_PUBLIC_FRAME_NAME', 'th3scr1b3');
  const imageUrl = readEnv('NEXT_PUBLIC_APP_HERO_IMAGE', `${appUrl}/image.png`);
  const splashImageUrl = readEnv('NEXT_PUBLIC_SPLASH_IMAGE', `${appUrl}/splash.png`);
  const splashBackgroundColor = readEnv('NEXT_PUBLIC_SPLASH_BG', '#eeccff');
  const buttonTitle = readEnv('NEXT_PUBLIC_FRAME_BUTTON_TITLE', 'Check this out');

  const miniAppEmbed = JSON.stringify({
    version: '1',
    imageUrl,
    button: {
      title: buttonTitle,
      action: {
        type: 'launch_miniapp',
        url: appUrl,
        name: appName,
        splashImageUrl,
        splashBackgroundColor,
      },
    },
  });

  const frameEmbed = JSON.stringify({
    version: '1',
    imageUrl,
    button: {
      title: buttonTitle,
      action: {
        type: 'launch_frame',
        url: appUrl,
        name: appName,
        splashImageUrl,
        splashBackgroundColor,
      },
    },
  });

  return (
    <html lang="en">
      <head>
        <meta name="fc:miniapp" content={miniAppEmbed} />
        <meta name="fc:frame" content={frameEmbed} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
