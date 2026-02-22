const DEFAULT_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000';
const DEFAULT_DONATION_ADDRESS = '0x0000000000000000000000000000000000000000';

function readEnvValue(key: string, fallback: string) {
  return process.env[key]?.trim() || fallback;
}

export const DAILY_MUSE_CONTRACT_ADDRESS =
  readEnvValue('NEXT_PUBLIC_DAILY_MUSE_CONTRACT_ADDRESS', DEFAULT_CONTRACT_ADDRESS);
export const MAIN_APP_URL = 'https://th3scr1b3.art';
export const PROJECT_NAME = '365 Days of Light and Dark';
export const MINT_PRICE_ETH = readEnvValue('NEXT_PUBLIC_MINT_PRICE_ETH', '0.001');

export const DONATION_ADDRESS =
  readEnvValue('NEXT_PUBLIC_DONATION_ADDRESS', DEFAULT_DONATION_ADDRESS);

export const DONATION_PRESET_AMOUNTS = readEnvValue(
  'NEXT_PUBLIC_DONATION_PRESETS',
  '0.001,0.005,0.01'
)
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);
