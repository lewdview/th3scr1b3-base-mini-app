'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  useAccount,
  useChainId,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { base } from 'wagmi/chains';
import { isAddress, parseEther } from 'viem';
import {
  DONATION_ADDRESS,
  DONATION_PRESET_AMOUNTS,
  DONATION_RECIPIENT_LABEL,
} from '../constants';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function toErrorMessage(error: unknown) {
  if (!error) return 'Donation failed.';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const maybeShort = (error as { shortMessage?: unknown }).shortMessage;
    if (typeof maybeShort === 'string' && maybeShort.length > 0) return maybeShort;
  }
  return 'Donation failed.';
}

function shortenAddress(address: string) {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function DonationCard() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const { sendTransactionAsync, isPending: isSending } = useSendTransaction();
  const [amount, setAmount] = useState(DONATION_PRESET_AMOUNTS[0] || '0.001');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [donationError, setDonationError] = useState<string | null>(null);

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    chainId: base.id,
    hash: txHash,
  });

  const hasDonationAddress =
    isAddress(DONATION_ADDRESS) && DONATION_ADDRESS !== ZERO_ADDRESS;
  const isBusy = isSwitchingChain || isSending || isConfirming;

  const helperText = useMemo(() => {
    if (!hasDonationAddress) return 'Donations are not configured yet.';
    if (!isConnected) return 'Connect your wallet to donate.';
    if (isConfirmed) return 'Donation confirmed. Thank you.';
    if (isBusy) return 'Processing donation...';
    const recipientLabel = DONATION_RECIPIENT_LABEL || shortenAddress(DONATION_ADDRESS);
    return `Recipient: ${recipientLabel}`;
  }, [hasDonationAddress, isConnected, isConfirmed, isBusy]);

  useEffect(() => {
    if (!receiptError) return;
    setDonationError(toErrorMessage(receiptError));
  }, [receiptError]);

  const sendDonation = async (donationAmount: string) => {
    if (isBusy) return;
    setDonationError(null);

    try {
      if (!hasDonationAddress) {
        throw new Error('Set NEXT_PUBLIC_DONATION_ADDRESS to enable donations.');
      }
      if (!isConnected) {
        throw new Error('Connect wallet to donate.');
      }
      if (!donationAmount || Number(donationAmount) <= 0) {
        throw new Error('Enter a valid ETH amount.');
      }

      const value = parseEther(donationAmount);
      if (typeof chainId === 'number' && chainId !== base.id) {
        await switchChainAsync({ chainId: base.id });
      }

      const hash = await sendTransactionAsync({
        to: DONATION_ADDRESS as `0x${string}`,
        value,
      });
      setTxHash(hash);
    } catch (error) {
      setDonationError(toErrorMessage(error));
    }
  };

  return (
    <section className="support-card donation-card animate-in">
      <div className="support-card-title">Donations (ETH)</div>
      <p className="support-card-copy">
        Help fund the daily drop run. Every tip goes straight to the artist wallet.
      </p>

      <div className="donation-preset-row">
        {DONATION_PRESET_AMOUNTS.map((preset) => (
          <button
            key={preset}
            className={`donation-chip ${amount === preset ? 'selected' : ''}`}
            onClick={() => {
              setAmount(preset);
              void sendDonation(preset);
            }}
            disabled={!hasDonationAddress || !isConnected || isBusy}
          >
            {preset} ETH
          </button>
        ))}
      </div>

      <form
        className="donation-custom-row"
        onSubmit={(event) => {
          event.preventDefault();
          void sendDonation(amount);
        }}
      >
        <input
          type="number"
          inputMode="decimal"
          min="0.000001"
          step="0.000001"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="donation-input"
          placeholder="0.001"
        />
        <button
          type="submit"
          className="donation-send-btn"
          disabled={!hasDonationAddress || !isConnected || isBusy}
        >
          {isBusy ? 'Sending...' : 'Send'}
        </button>
      </form>

      <div className="support-card-helper">{donationError || helperText}</div>
    </section>
  );
}
