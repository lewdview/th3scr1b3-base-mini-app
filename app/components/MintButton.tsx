'use client';

import { DAILY_MUSE_CONTRACT_ADDRESS, MINT_PRICE_ETH } from '../constants';

type MintButtonProps = {
    day: number;
    disabled?: boolean;
};

const MintIcon = () => (
    <svg className="mint-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
    </svg>
);

export function MintButton({ day, disabled = false }: MintButtonProps) {
    const handleMint = () => {
        // TODO: Replace with actual OnchainKit Transaction component
        // once contract is deployed. For now, show placeholder.
        console.log(`[Mint] Day ${day} on contract ${DAILY_MUSE_CONTRACT_ADDRESS} for ${MINT_PRICE_ETH} ETH`);
        alert(`Minting Day ${day} NFT\n\nPrice: ${MINT_PRICE_ETH} ETH\nContract: ${DAILY_MUSE_CONTRACT_ADDRESS}\nToken ID: ${day}\n\nConnect a wallet and deploy your NFT contract to enable minting.`);
    };

    return (
        <button
            className="mint-btn"
            onClick={(e) => {
                e.stopPropagation();
                handleMint();
            }}
            disabled={disabled}
            title={`Mint Day ${day} as NFT`}
        >
            <MintIcon />
            Mint ({MINT_PRICE_ETH} ETH)
        </button>
    );
}
