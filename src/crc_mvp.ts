/**
 * CRC-32 (IEEE 802.3) Minimum Viable Product (MVP)
 * Standalone, zero-dependency implementation of Modulo-2 Polynomial Division,
 * Sender-side CRC Generation, and Receiver-side Verification.
 */

// ==========================================
// 1. IEEE 802.3 STANDARD CONSTANTS
// ==========================================
// Generator polynomial: G(x) = x³² + x²⁶ + x²³ + x²² + x¹⁶ + x¹² + x¹¹ + x¹⁰ + x⁸ + x⁷ + x⁵ + x⁴ + x² + x + 1
// Binary Divisor: 33 bits (Degree 32)
export const GENERATOR_POLYNOMIAL = '100000100110000010001110110110111';
export const GENERATOR_POLYNOMIAL_HEX = '0x04C11DB7';
export const CRC_BITS = 32;

// ==========================================
// 2. MODULO-2 XOR OPERATION (GF(2) Addition)
// ==========================================
// Carryless bitwise XOR. Drops index 0 because 1^1 = 0 cancels the leading bit.
export function xor(a: string, b: string): string {
  let result = '';
  for (let i = 1; i < b.length; i++) {
    result += a[i] === b[i] ? '0' : '1';
  }
  return result;
}

// ==========================================
// 3. CORE MODULO-2 POLYNOMIAL DIVISION
// ==========================================
// Divides dividend by divisor and returns the 32-bit mathematical remainder R(x).
export function mod2div(dividend: string, divisor: string = GENERATOR_POLYNOMIAL): string {
  const polyDegree = divisor.length - 1; // 32
  const pick = divisor.length;           // 33

  if (!dividend || dividend.length === 0) {
    return '0'.repeat(polyDegree);
  }
  if (dividend.length < divisor.length) {
    return dividend.padStart(polyDegree, '0');
  }

  let tmp = dividend.slice(0, pick);
  const zeros = '0'.repeat(pick);

  // Slide window across all dividend bits
  for (let i = pick; i < dividend.length; i++) {
    if (tmp[0] === '1') {
      tmp = xor(divisor, tmp) + dividend[i];
    } else {
      tmp = xor(zeros, tmp) + dividend[i];
    }
  }

  // Final reduction step
  if (tmp[0] === '1') {
    tmp = xor(divisor, tmp);
  } else {
    tmp = xor(zeros, tmp);
  }

  return tmp.padStart(polyDegree, '0');
}

// ==========================================
// 4. SENDER ENGINE: GENERATE CODEWORD
// ==========================================
// Multiplies D(x) by x³² (zero-padding), computes R(x), and outputs T(x) = D(x) + R(x)
export function generateCodeword(dataword: string): {
  dataword: string;
  paddedDataword: string;
  crcRemainder: string;
  crcHex: string;
  transmittedCodeword: string;
} {
  const paddedDataword = dataword + '0'.repeat(CRC_BITS);
  const crcRemainder = mod2div(paddedDataword, GENERATOR_POLYNOMIAL);
  const crcHex = binToHex(crcRemainder);
  const transmittedCodeword = dataword + crcRemainder;

  return {
    dataword,
    paddedDataword,
    crcRemainder,
    crcHex,
    transmittedCodeword,
  };
}

// ==========================================
// 5. RECEIVER ENGINE: VERIFY CODEWORD
// ==========================================
// Divides received bitstream T'(x) by G(x). Remainder === 0 -> Valid, else -> Corrupted.
export function verifyCodeword(receivedCodeword: string): {
  isValid: boolean;
  remainder: string;
  remainderHex: string;
} {
  const remainder = mod2div(receivedCodeword, GENERATOR_POLYNOMIAL);
  const remainderHex = binToHex(remainder);
  const isValid = remainder === '0'.repeat(CRC_BITS);

  return {
    isValid,
    remainder,
    remainderHex,
  };
}

// ==========================================
// 6. HELPER UTILITIES
// ==========================================
export function binToHex(bin: string): string {
  const remainder = bin.length % 4;
  const paddedBin = remainder !== 0 ? '0'.repeat(4 - remainder) + bin : bin;
  let hex = '';
  for (let i = 0; i < paddedBin.length; i += 4) {
    const chunk = paddedBin.slice(i, i + 4);
    hex += parseInt(chunk, 2).toString(16).toUpperCase();
  }
  return '0x' + hex.padStart(8, '0');
}

export function textToBinary(text: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += bytes[i].toString(2).padStart(8, '0');
  }
  return binary;
}
