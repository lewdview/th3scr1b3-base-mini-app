'use client';

import { useMemo, useState } from 'react';
import { useMiniKit } from '@coinbase/onchainkit/minikit';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

function shortenAddress(address?: string) {
  if (!address) return '';
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function toErrorMessage(error: unknown) {
  if (!error) return 'Connection failed.';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const shortMessage = (error as { shortMessage?: unknown }).shortMessage;
    if (typeof shortMessage === 'string' && shortMessage.length > 0) return shortMessage;
  }
  return 'Connection failed.';
}

export function WalletButton() {
  const { context } = useMiniKit();
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [connectError, setConnectError] = useState<string | null>(null);

  const user = context?.user;
  const primaryConnector = connectors[0];

  const profileLabel = useMemo(() => {
    if (user?.username) return `@${user.username}`;
    if (user?.displayName) return user.displayName;
    if (isConnected && address) return shortenAddress(address);
    return 'Connect Wallet';
  }, [user?.username, user?.displayName, isConnected, address]);

  const detailLabel = useMemo(() => {
    if (connectError) return connectError;
    if (user?.fid) {
      return `Farcaster fid ${user.fid}${address ? ` · ${shortenAddress(address)}` : ''}`;
    }
    if (isConnected && address) return `Connected: ${shortenAddress(address)}`;
    if (!primaryConnector) return 'No wallet connector available.';
    return `Connector: ${primaryConnector.name}`;
  }, [connectError, user?.fid, isConnected, address, primaryConnector]);

  const connectWallet = async () => {
    if (!primaryConnector || isPending) return;
    try {
      setConnectError(null);
      await connectAsync({ connector: primaryConnector });
    } catch (error) {
      setConnectError(toErrorMessage(error));
    }
  };

  return (
    <div className="wallet-wrapper">
      {isConnected ? (
        <div className="wallet-connected-row">
          <div className="wallet-connected-pill">{profileLabel}</div>
          <button
            type="button"
            className="wallet-disconnect-btn"
            onClick={() => disconnect()}
            title="Disconnect wallet"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="wallet-connect-btn"
          onClick={connectWallet}
          disabled={!primaryConnector || isPending}
        >
          {isPending ? 'Connecting...' : profileLabel}
        </button>
      )}
      <div className={`wallet-status ${connectError ? 'wallet-status-error' : ''}`}>
        {detailLabel}
      </div>
    </div>
  );
}
