'use client';

import { Wallet, ConnectWallet, WalletDropdown, WalletDropdownDisconnect } from '@coinbase/onchainkit/wallet';

export function WalletButton() {
    return (
        <div className="wallet-wrapper">
            <Wallet>
                <ConnectWallet>
                    <span>Connect</span>
                </ConnectWallet>
                <WalletDropdown>
                    <WalletDropdownDisconnect />
                </WalletDropdown>
            </Wallet>
        </div>
    );
}
