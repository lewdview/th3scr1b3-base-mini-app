'use client';

import { MiniKitProvider } from '@coinbase/onchainkit/minikit';
import { base } from 'wagmi/chains';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { AudioProvider } from './components/AudioProvider';
import { AudioPlayer } from './components/AudioPlayer';
import {
  APP_THEME_STORAGE_KEY,
  DEFAULT_APP_THEME_ID,
  isAppThemeId,
} from './lib/app-theme';

const apiKey = process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY || '';
const projectName = process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'th3scr1b3';

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    const applyTheme = (theme: string) => {
      document.body.dataset.appTheme = theme;
    };

    const stored = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
    applyTheme(isAppThemeId(stored) ? stored : DEFAULT_APP_THEME_ID);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== APP_THEME_STORAGE_KEY) return;
      applyTheme(isAppThemeId(event.newValue) ? event.newValue : DEFAULT_APP_THEME_ID);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <MiniKitProvider
      apiKey={apiKey}
      chain={base}
      config={{
        appearance: {
          mode: 'dark' as const,
          theme: 'cyberpunk' as const,
          name: projectName,
          logo: process.env.NEXT_PUBLIC_ICON_URL,
        },
      }}
    >
      <AudioProvider>
        {children}
        <AudioPlayer />
      </AudioProvider>
    </MiniKitProvider>
  );
}
