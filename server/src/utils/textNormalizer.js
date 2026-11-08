/**
 * Text Preprocessing & Normalization Utility
 * Prepares transcripts and segments for entity extraction and product matching
 */

// Hindi and English number words mapped to numerical values
export const NUMBER_WORDS = {
  // Hindi number words
  ek: '1',
  aik: '1',
  do: '2',
  teen: '3',
  tin: '3',
  chaar: '4',
  char: '4',
  paanch: '5',
  panch: '5',
  che: '6',
  chhe: '6',
  chhah: '6',
  saat: '7',
  aath: '8',
  nau: '9',
  das: '10',
  dus: '10',
  aadha: '0.5',
  adha: '0.5',
  dedh: '1.5',
  dhaai: '2.5',
  dhai: '2.5',

  // English number words
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  half: '0.5',
};

// Unit variations mapped to canonical units
export const UNIT_VARIATIONS = {
  // Weight
  kg: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  kgs: 'kg',
  g: 'g',
  gram: 'g',
  grams: 'g',
  gm: 'g',
  gms: 'g',

  // Volume
  litre: 'litre',
  liter: 'litre',
  litres: 'litre',
  liters: 'litre',
  l: 'litre',
  ltr: 'litre',
  ltrs: 'litre',
  ml: 'ml',
  mls: 'ml',
  millilitre: 'ml',
  milliliter: 'ml',

  // Packaging / Counts
  packet: 'packet',
  packets: 'packet',
  pkt: 'packet',
  pkts: 'packet',
  pouch: 'packet',
  pouches: 'packet',
  pack: 'packet',
  packs: 'packet',
  piece: 'piece',
  pieces: 'piece',
  pc: 'piece',
  pcs: 'piece',
  bottle: 'bottle',
  bottles: 'bottle',
  box: 'box',
  boxes: 'box',
  dabba: 'box',
  dibba: 'box',
};

// Common Indian retail conversational fillers and honorifics
export const FILLER_WORDS = [
  'bhaiya',
  'bhai',
  'bhaiji',
  'uncle',
  'ji',
  'sahab',
  'kripya',
  'please',
  'zara',
  'thoda',
  'mujhe',
  'humein',
  'humko',
  'give me',
  'i want',
  'can you give',
  'de dena',
  'de do',
  'de dijiye',
  'de dena ji',
  'de do bhaiya',
  'chahiye',
  'pack kar do',
  'pack kardo',
  'kar do',
  'bhejo',
  'bhej do',
  'lana',
  'dena',
  'karo',
  'dal do',
  'daal do',
];

/**
 * Normalizes customer transcript:
 * Trims whitespace, cleans redundant punctuation, lowercases while preserving original
 * @param {string} text
 * @returns {string}
 */
export const normalizeText = (text) => {
  if (!text || typeof text !== 'string') return '';

  return text
    .toLowerCase()
    // Replace multiple spaces/newlines with single space
    .replace(/\s+/g, ' ')
    // Normalize dashes and quotes
    .replace(/[–—]/g, '-')
    .replace(/["']/g, '')
    .trim();
};

/**
 * Converts spelled-out Hindi/English number words to digits
 * @param {string} text
 * @returns {string}
 */
export const replaceNumberWords = (text) => {
  if (!text) return '';

  let result = text;
  // Replace each whole word matching a known number word
  for (const [word, digit] of Object.entries(NUMBER_WORDS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    result = result.replace(regex, digit);
  }
  return result;
};

/**
 * Normalizes a raw unit string into its canonical representation
 * @param {string} rawUnit
 * @returns {string|null}
 */
export const normalizeUnit = (rawUnit) => {
  if (!rawUnit) return null;
  const clean = rawUnit.toLowerCase().trim();
  return UNIT_VARIATIONS[clean] || clean;
};

/**
 * Cleans conversational fillers and honorifics from a product text segment
 * @param {string} text
 * @returns {string}
 */
export const cleanConversationalFillers = (text) => {
  if (!text) return '';

  let cleaned = text;
  // Sort fillers by length descending so multi-word phrases match first
  const sortedFillers = [...FILLER_WORDS].sort((a, b) => b.length - a.length);

  for (const filler of sortedFillers) {
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    cleaned = cleaned.replace(regex, ' ');
  }

  // Remove leading/trailing punctuation and extra whitespace
  return cleaned
    .replace(/^[,.!?\-\s]+|[,.!?\-\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};
