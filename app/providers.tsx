'use client';

import { MiniKitProvider } from '@coinbase/onchainkit/minikit';
import { base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { coinbaseWallet } from 'wagmi/connectors';
import type { ReactNode } from 'react';
import { AudioProvider } from './components/AudioProvider';

const apiKey = process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY || '';
const projectName = process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'th3scr1b3';

const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({ appName: projectName }),
  ],
  transports: {
    [base.id]: http(),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
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
          </AudioProvider>
        </MiniKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
