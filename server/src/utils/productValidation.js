/**
 * Product Validation Utilities
 * Shared validation and formatting functions for product catalogue management and bulk import.
 */

// Standard UUID format validator (8-4-4-4-12 hex format)
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isValidUuid = (id) => typeof id === 'string' && UUID_REGEX.test(id);

/**
 * Validates and formats monetary price value
 * Ensures price is a valid, positive decimal number with up to 2 decimal places.
 *
 * @param {string|number} price
 * @param {boolean} [isRequired=true]
 * @returns {string|undefined} Formatted 2-decimal string (e.g. "55.00")
 */
export const validateAndFormatPrice = (price, isRequired = true) => {
  if (price === undefined || price === null || price === '') {
    if (isRequired) {
      const err = new Error('Product price is required');
      err.statusCode = 400;
      throw err;
    }
    return undefined;
  }

  const num = Number(price);
  if (isNaN(num) || !isFinite(num)) {
    const err = new Error('Product price must be a valid positive number');
    err.statusCode = 400;
    throw err;
  }

  if (num <= 0) {
    const err = new Error('Price must be greater than zero');
    err.statusCode = 400;
    throw err;
  }

  return num.toFixed(2);
};

/**
 * Parses and validates boolean availability value
 *
 * @param {any} val
 * @param {boolean} [defaultValue=true]
 * @returns {boolean}
 */
export const parseAvailability = (val, defaultValue = true) => {
  if (val === undefined || val === null || val === '') return defaultValue;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
  }
  const err = new Error('Invalid availability value. Must be a boolean (true/false)');
  err.statusCode = 400;
  throw err;
};

/**
 * Strips or prefixes dangerous formula characters from cell values
 * to protect against CSV / Excel Formula Injection (DDE injection).
 * Characters: =, +, -, @, \t, \r
 *
 * @param {string} value
 * @returns {string} Sanitized string safe for CSV/Excel export
 */
export const sanitizeCsvCell = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    // Prefix with single quote to force spreadsheet programs to treat as text
    return `'${str}`;
  }
  return str;
};

