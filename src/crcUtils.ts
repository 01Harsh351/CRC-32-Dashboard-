/**
 * CRC-32 IEEE 802.3 modulo-2 division and verification utilities.
 * Generator polynomial: 100000100110000010001110110110111 (Degree 32, 33 bits)
 */

export const GENERATOR_POLYNOMIAL = '100000100110000010001110110110111';
export const GENERATOR_POLYNOMIAL_HEX = '0x04C11DB7';
export const GENERATOR_POLYNOMIAL_EXPANDED =
  'x³² + x²⁶ + x²³ + x²² + x¹⁶ + x¹² + x¹¹ + x¹⁰ + x⁸ + x⁷ + x⁵ + x⁴ + x² + x + 1';
export const CRC_BITS = 32;

/**
 * Modulo-2 bitwise XOR between two binary strings of the same length,
 * returning the XOR result excluding the leading bit (which cancels out to 0).
 */
export function xor(a: string, b: string): string {
  let result = '';
  for (let i = 1; i < b.length; i++) {
    result += a[i] === b[i] ? '0' : '1';
  }
  return result;
}

/**
 * Modulo-2 division of dividend by divisor.
 * Returns the remainder with length = divisor.length - 1 (32 bits for CRC-32).
 */
export function mod2div(dividend: string, divisor: string): string {
  const polyDegree = divisor.length - 1;
  if (!dividend || dividend.length === 0) {
    return '0'.repeat(polyDegree);
  }
  if (dividend.length < divisor.length) {
    return dividend.padStart(polyDegree, '0');
  }

  const pick = divisor.length;
  let tmp = dividend.slice(0, pick);
  const zeros = '0'.repeat(pick);

  for (let i = pick; i < dividend.length; i++) {
    if (tmp[0] === '1') {
      tmp = xor(divisor, tmp) + dividend[i];
    } else {
      tmp = xor(zeros, tmp) + dividend[i];
    }
  }

  if (tmp[0] === '1') {
    tmp = xor(divisor, tmp);
  } else {
    tmp = xor(zeros, tmp);
  }

  return tmp.padStart(polyDegree, '0');
}

/**
 * Converts a binary string to hexadecimal representation formatted as 0xXXXXXXXX.
 */
export function binToHex(bin: string): string {
  // Pad with leading zeros if not multiple of 4
  const remainder = bin.length % 4;
  const paddedBin = remainder !== 0 ? '0'.repeat(4 - remainder) + bin : bin;
  let hex = '';
  for (let i = 0; i < paddedBin.length; i += 4) {
    const chunk = paddedBin.slice(i, i + 4);
    const val = parseInt(chunk, 2);
    hex += val.toString(16).toUpperCase();
  }
  return '0x' + hex.padStart(8, '0');
}

/**
 * Converts text/message to 8-bit binary representation using UTF-8 encoding.
 */
export function textToBinary(text: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += bytes[i].toString(2).padStart(8, '0');
  }
  return binary;
}

/**
 * Converts file bytes (Uint8Array) to binary string.
 */
export function fileBytesToBinary(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += bytes[i].toString(2).padStart(8, '0');
  }
  return binary;
}

/**
 * Checks if a string contains only binary '0' and '1' characters.
 */
export function isValidBinaryString(str: string): boolean {
  if (!str || str.length === 0) return false;
  return /^[01]+$/.test(str);
}

/**
 * Clean whitespace and formatting from raw binary input.
 */
export function cleanBinaryInput(raw: string): string {
  return raw.replace(/[\s\r\n\t_]/g, '');
}

/**
 * Result structure for CRC generation and verification
 */
export interface CRCState {
  inputType: 'binary' | 'text' | 'file';
  originalInput: string;
  dataword: string;
  paddedDataword: string;
  generator: string;
  referenceCRC: string;
  referenceCRCHex: string;
  generatedCodeword: string;
  currentCodeword: string;
  currentRemainder: string;
  currentRemainderHex: string;
  isValid: boolean;
  flippedBitIndex: number | null;
  errorSimulationActive: boolean;
  fileName?: string;
  fileSize?: number;
}

/**
 * Computes CRC-32 generation for clean dataword
 */
export function generateCRC(
  dataword: string,
  inputType: 'binary' | 'text' | 'file',
  originalInput: string,
  meta?: { fileName?: string; fileSize?: number }
): CRCState {
  const paddedDataword = dataword + '0'.repeat(CRC_BITS);
  const referenceCRC = mod2div(paddedDataword, GENERATOR_POLYNOMIAL);
  const referenceCRCHex = binToHex(referenceCRC);
  const generatedCodeword = dataword + referenceCRC;

  // Initial verification on newly generated codeword
  const currentRemainder = mod2div(generatedCodeword, GENERATOR_POLYNOMIAL);
  const currentRemainderHex = binToHex(currentRemainder);
  const isValid = currentRemainder === '0'.repeat(CRC_BITS);

  return {
    inputType,
    originalInput,
    dataword,
    paddedDataword,
    generator: GENERATOR_POLYNOMIAL,
    referenceCRC,
    referenceCRCHex,
    generatedCodeword,
    currentCodeword: generatedCodeword,
    currentRemainder,
    currentRemainderHex,
    isValid,
    flippedBitIndex: null,
    errorSimulationActive: false,
    fileName: meta?.fileName,
    fileSize: meta?.fileSize,
  };
}

/**
 * Verifies a current codeword against the CRC-32 generator polynomial
 */
export function verifyCodeword(
  state: CRCState,
  codewordToVerify: string
): CRCState {
  const currentRemainder = mod2div(codewordToVerify, GENERATOR_POLYNOMIAL);
  const currentRemainderHex = binToHex(currentRemainder);
  const isValid = currentRemainder === '0'.repeat(CRC_BITS);

  return {
    ...state,
    currentCodeword: codewordToVerify,
    currentRemainder,
    currentRemainderHex,
    isValid,
  };
}

/**
 * Simulates a single bit inversion at specified index
 */
export function simulateBitFlip(state: CRCState, bitIndex: number): CRCState {
  if (bitIndex < 0 || bitIndex >= state.generatedCodeword.length) {
    throw new Error(
      `Bit index ${bitIndex} is out of bounds (0 to ${state.generatedCodeword.length - 1}).`
    );
  }

  const targetBit = state.generatedCodeword[bitIndex];
  const invertedBit = targetBit === '0' ? '1' : '0';
  const corruptedCodeword =
    state.generatedCodeword.slice(0, bitIndex) +
    invertedBit +
    state.generatedCodeword.slice(bitIndex + 1);

  // Automatically verify the corrupted codeword
  const currentRemainder = mod2div(corruptedCodeword, GENERATOR_POLYNOMIAL);
  const currentRemainderHex = binToHex(currentRemainder);
  const isValid = currentRemainder === '0'.repeat(CRC_BITS);

  return {
    ...state,
    currentCodeword: corruptedCodeword,
    currentRemainder,
    currentRemainderHex,
    isValid,
    flippedBitIndex: bitIndex,
    errorSimulationActive: true,
  };
}

/**
 * Simulates a burst of bit errors starting at specified index with given length
 */
export function simulateBurstError(
  state: CRCState,
  startIndex: number,
  burstLength = 3
): CRCState {
  const codewordArr = state.generatedCodeword.split('');
  const maxStart = Math.max(0, codewordArr.length - burstLength);
  const safeStart = Math.min(Math.max(0, startIndex), maxStart);

  for (let i = 0; i < burstLength; i++) {
    const idx = safeStart + i;
    if (idx < codewordArr.length) {
      codewordArr[idx] = codewordArr[idx] === '0' ? '1' : '0';
    }
  }

  const corruptedCodeword = codewordArr.join('');
  const currentRemainder = mod2div(corruptedCodeword, GENERATOR_POLYNOMIAL);
  const currentRemainderHex = binToHex(currentRemainder);
  const isValid = currentRemainder === '0'.repeat(CRC_BITS);

  return {
    ...state,
    currentCodeword: corruptedCodeword,
    currentRemainder,
    currentRemainderHex,
    isValid,
    flippedBitIndex: safeStart,
    errorSimulationActive: true,
  };
}

/**
 * Inverts a random bit in the generated codeword
 */
export function simulateRandomBitFlip(state: CRCState): CRCState {
  const randomIndex = Math.floor(Math.random() * state.generatedCodeword.length);
  return simulateBitFlip(state, randomIndex);
}

/**
 * Generates CSV content string for export
 */
export function generateCSVReport(state: CRCState): string {
  const escapeCsv = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const headers = [
    'Timestamp',
    'Input Type',
    'File Name',
    'Dataword Bit Length',
    'Original Dataword',
    'Generator Polynomial',
    'Padded Dataword',
    'Reference CRC (Bin)',
    'Reference CRC (Hex)',
    'Original Codeword',
    'Current Codeword',
    'Flipped Bit Index',
    'Current Remainder (Bin)',
    'Current Remainder (Hex)',
    'Verification Status',
  ];

  const statusLabel = state.isValid
    ? 'VALID / NOT CORRUPTED'
    : 'CORRUPTED / ERROR DETECTED';

  const rows = [
    [
      new Date().toISOString(),
      state.inputType.toUpperCase(),
      state.fileName || 'N/A',
      state.dataword.length,
      state.dataword,
      state.generator,
      state.paddedDataword,
      state.referenceCRC,
      state.referenceCRCHex,
      state.generatedCodeword,
      state.currentCodeword,
      state.flippedBitIndex !== null ? state.flippedBitIndex : 'None',
      state.currentRemainder,
      state.currentRemainderHex,
      statusLabel,
    ].map(escapeCsv).join(','),
  ];

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Calculates bit differences between original transmitted codeword and received codeword.
 */
export function getBitDifferences(original: string, current: string): { indices: number[]; count: number } {
  const indices: number[] = [];
  const minLen = Math.min(original.length, current.length);
  for (let i = 0; i < minLen; i++) {
    if (original[i] !== current[i]) {
      indices.push(i);
    }
  }
  const lengthDiff = Math.abs(original.length - current.length);
  return {
    indices,
    count: indices.length + lengthDiff,
  };
}

/**
 * Formats a binary string in groups of N bits for cleaner display.
 */
export function formatBitStream(bin: string, chunkSize = 8): string {
  if (!bin) return '';
  const chunks: string[] = [];
  for (let i = 0; i < bin.length; i += chunkSize) {
    chunks.push(bin.slice(i, i + chunkSize));
  }
  return chunks.join(' ');
}
