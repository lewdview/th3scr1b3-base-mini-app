import { concatHex, numberToHex, stringToHex, type Hex } from 'viem';
import { BASE_BUILDER_CODE } from '../constants';

const ERC_8021_SCHEMA_ID_CANONICAL = 0;
const ERC_8021_MARKER = '0x80218021802180218021802180218021';

function toBuilderDataSuffix(code: string): Hex | undefined {
  const trimmed = code.trim();
  if (!trimmed) return undefined;

  const codesHex = stringToHex(trimmed);
  const codesByteLength = (codesHex.length - 2) / 2;

  if (codesByteLength > 255) {
    throw new Error('Builder code is too long for ERC-8021 schema 0 encoding.');
  }

  return concatHex([
    codesHex,
    numberToHex(codesByteLength, { size: 1 }),
    numberToHex(ERC_8021_SCHEMA_ID_CANONICAL, { size: 1 }),
    ERC_8021_MARKER,
  ]);
}

export const BASE_BUILDER_DATA_SUFFIX = toBuilderDataSuffix(BASE_BUILDER_CODE);
