/**
 * DecimalSafe - Scale-safe arithmetic helper for monetary values
 * Prevents floating-point precision errors (e.g. 0.1 + 0.2 !== 0.3)
 */

const SCALE = 10000n; // 4 decimal places for internal precision
const DISPLAY_DECIMALS = 2;

/**
 * Converts a string, number, or Prisma Decimal to scaled BigInt
 * @param {string|number|object} value
 * @returns {bigint}
 */
export const toScaledBigInt = (value) => {
  if (value === null || value === undefined) return 0n;

  let strVal = typeof value === 'object' && value.toString ? value.toString() : String(value).trim();
  if (!strVal || isNaN(Number(strVal))) return 0n;

  const isNegative = strVal.startsWith('-');
  if (isNegative) strVal = strVal.slice(1);

  const [intPart, fracPart = ''] = strVal.split('.');
  const paddedFrac = (fracPart + '0000').slice(0, 4);

  const scaled = BigInt(intPart || '0') * SCALE + BigInt(paddedFrac);
  return isNegative ? -scaled : scaled;
};

/**
 * Multiplies two decimal values safely
 * @param {string|number|object} qty
 * @param {string|number|object} price
 * @returns {string} Formatted decimal string with 2 decimal places
 */
export const multiplyDecimals = (qty, price) => {
  const scaledQty = toScaledBigInt(qty);
  const scaledPrice = toScaledBigInt(price);

  // scaledQty * scaledPrice produces SCALE^2, divide by SCALE to normalize
  const scaledResult = (scaledQty * scaledPrice) / SCALE;
  return formatScaledBigInt(scaledResult, DISPLAY_DECIMALS);
};

/**
 * Adds two decimal values safely
 * @param {string|number|object} a
 * @param {string|number|object} b
 * @returns {string}
 */
export const addDecimals = (a, b) => {
  const scaledA = toScaledBigInt(a);
  const scaledB = toScaledBigInt(b);
  return formatScaledBigInt(scaledA + scaledB, DISPLAY_DECIMALS);
};

/**
 * Sums an array of decimal strings/numbers safely
 * @param {Array<string|number|object>} values
 * @returns {string}
 */
export const sumDecimals = (values) => {
  let total = 0n;
  for (const val of values) {
    if (val !== null && val !== undefined) {
      total += toScaledBigInt(val);
    }
  }
  return formatScaledBigInt(total, DISPLAY_DECIMALS);
};

/**
 * Formats scaled BigInt to standard decimal string with rounding
 * @param {bigint} scaled
 * @param {number} decimals
 * @returns {string}
 */
export const formatScaledBigInt = (scaled, decimals = 2) => {
  const isNegative = scaled < 0n;
  const absVal = isNegative ? -scaled : scaled;

  // Rounding: add 50 if rounding to 2 decimals (since scale is 10000)
  const roundOffset = 50n;
  const rounded = absVal + roundOffset;

  const intPart = rounded / SCALE;
  const remainder = rounded % SCALE;
  const fracDigits = (remainder / 100n).toString().padStart(decimals, '0');

  const formatted = `${intPart}.${fracDigits.slice(0, decimals)}`;
  return isNegative ? `-${formatted}` : formatted;
};

/**
 * Formats a general value to 2 decimal places string
 * @param {string|number|object} val
 * @returns {string}
 */
export const formatCurrency = (val) => {
  return formatScaledBigInt(toScaledBigInt(val), 2);
};

