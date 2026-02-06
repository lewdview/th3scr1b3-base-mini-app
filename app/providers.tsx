'use client';

import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base } from 'wagmi/chains';
import type { ReactNode } from 'react';

const apiKey = process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY || '';
const projectName = process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'th3scr1b3';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <OnchainKitProvider
      apiKey={apiKey}
      chain={base}
      config={{
        appearance: {
          mode: 'dark',
          theme: 'cyberpunk',
          name: projectName,
          logo: process.env.NEXT_PUBLIC_ICON_URL,
        },
      }}
      miniKit={{
        enabled: true,
        autoConnect: true,
      }}
    >
      {children}
    </OnchainKitProvider>
  );
}
