'use client';

import { useEffect, useState } from 'react';
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { base } from 'wagmi/chains';
import { isAddress, parseEther } from 'viem';
import { DAILY_MUSE_CONTRACT_ADDRESS, MINT_PRICE_ETH } from '../constants';

type MintButtonProps = {
    day: number;
    disabled?: boolean;
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const DAILY_MUSE_ABI = [
    {
        type: 'function',
        name: 'mint',
        stateMutability: 'payable',
        inputs: [
            { name: 'id', type: 'uint256' },
            { name: 'amount', type: 'uint256' },
            { name: 'data', type: 'bytes' },
        ],
        outputs: [],
    },
    {
        type: 'function',
        name: 'getPrice',
        stateMutability: 'view',
        inputs: [{ name: 'id', type: 'uint256' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        type: 'function',
        name: 'mintingOpen',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'bool' }],
    },
] as const;

const MintIcon = () => (
    <svg className="mint-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
    </svg>
);

function toErrorMessage(error: unknown) {
    if (!error) return 'Mint failed.';
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (typeof error === 'object') {
        const maybeShort = (error as { shortMessage?: unknown }).shortMessage;
        if (typeof maybeShort === 'string' && maybeShort.length > 0) return maybeShort;
    }
    return 'Mint failed.';
}

function parsePrice(value: string) {
    try {
        return parseEther(value);
    } catch {
        return 0n;
    }
}

export function MintButton({ day, disabled = false }: MintButtonProps) {
    const { isConnected } = useAccount();
    const chainId = useChainId();
    const publicClient = usePublicClient({ chainId: base.id });
    const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
    const { writeContractAsync, isPending: isSubmittingTx } = useWriteContract();
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
    const [isPreparingTx, setIsPreparingTx] = useState(false);
    const [mintError, setMintError] = useState<string | null>(null);

    const {
        isLoading: isConfirmingTx,
        isSuccess: isConfirmed,
        error: receiptError,
    } = useWaitForTransactionReceipt({
        chainId: base.id,
        hash: txHash,
    });

    const contractAddress = DAILY_MUSE_CONTRACT_ADDRESS as `0x${string}`;
    const hasContractAddress =
        isAddress(DAILY_MUSE_CONTRACT_ADDRESS) &&
        DAILY_MUSE_CONTRACT_ADDRESS !== ZERO_ADDRESS;
    const fallbackPriceWei = parsePrice(MINT_PRICE_ETH);

    useEffect(() => {
        if (!receiptError) return;
        setMintError(toErrorMessage(receiptError));
    }, [receiptError]);

    useEffect(() => {
        if (!isConfirmed) return;
        const timer = window.setTimeout(() => {
            setTxHash(undefined);
        }, 3000);
        return () => window.clearTimeout(timer);
    }, [isConfirmed]);

    const isBusy = isPreparingTx || isSwitchingChain || isSubmittingTx || isConfirmingTx;

    const handleMint = async () => {
        if (isBusy) return;
        setMintError(null);

        try {
            if (!hasContractAddress) {
                throw new Error('Minting is not configured: set NEXT_PUBLIC_DAILY_MUSE_CONTRACT_ADDRESS.');
            }
            if (!isConnected) {
                throw new Error('Connect your wallet to mint.');
            }

            setIsPreparingTx(true);

            if (chainId !== base.id) {
                await switchChainAsync({ chainId: base.id });
            }

            const tokenId = BigInt(day);
            let mintPrice = fallbackPriceWei;

            if (publicClient) {
                const mintingOpen = await publicClient.readContract({
                    address: contractAddress,
                    abi: DAILY_MUSE_ABI,
                    functionName: 'mintingOpen',
                });

                if (!mintingOpen) {
                    throw new Error('Minting is currently closed.');
                }

                mintPrice = await publicClient.readContract({
                    address: contractAddress,
                    abi: DAILY_MUSE_ABI,
                    functionName: 'getPrice',
                    args: [tokenId],
                });
            }

            const hash = await writeContractAsync({
                address: contractAddress,
                abi: DAILY_MUSE_ABI,
                functionName: 'mint',
                args: [tokenId, 1n, '0x'],
                value: mintPrice,
                chainId: base.id,
            });

            setTxHash(hash);
        } catch (error) {
            setMintError(toErrorMessage(error));
        } finally {
            setIsPreparingTx(false);
        }
    };

    let label = `Mint (${MINT_PRICE_ETH} ETH)`;
    if (!hasContractAddress) label = 'Mint Off';
    else if (!isConnected) label = 'Connect to Mint';
    else if (isSwitchingChain) label = 'Switching...';
    else if (isBusy) label = 'Minting...';
    else if (isConfirmed) label = 'Minted';

    return (
        <button
            className="mint-btn"
            onClick={(e) => {
                e.stopPropagation();
                void handleMint();
            }}
            disabled={disabled || !hasContractAddress || !isConnected || isBusy}
            title={mintError || `Mint Day ${day} as NFT`}
        >
            <MintIcon />
            {label}
        </button>
    );
}
