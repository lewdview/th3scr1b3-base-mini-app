'use client';

import { MiniKitProvider } from '@coinbase/onchainkit/minikit';
import { base } from 'wagmi/chains';
import type { ReactNode } from 'react';
import { AudioProvider } from './components/AudioProvider';

const apiKey = process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY || '';
const projectName = process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'th3scr1b3';

export function Providers({ children }: { children: ReactNode }) {
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
      <AudioProvider>{children}</AudioProvider>
    </MiniKitProvider>
  );
}
