/**
 * Text Preprocessing & Multilingual Normalization Utility
 * Prepares transcripts and segments for entity extraction and product matching
 * Unified for Hindi (Devanagari), English, and Hinglish (Roman Hindi)
 */

// Devanagari numerals to Western digits mapping
export const DEVANAGARI_DIGITS = {
  '०': '0',
  '१': '1',
  '२': '2',
  '३': '3',
  '४': '4',
  '५': '5',
  '६': '6',
  '७': '7',
  '८': '8',
  '९': '9',
};

// Hindi (Devanagari & Roman) and English number words mapped to numerical values
export const NUMBER_WORDS = {
  // --- Devanagari Hindi Number Words & Fractions ---
  'एक': '1',
  'दो': '2',
  'तीन': '3',
  'चार': '4',
  'पांच': '5',
  'पाँच': '5',
  'छह': '6',
  'छः': '6',
  'सात': '7',
  'आठ': '8',
  'नौ': '9',
  'दस': '10',
  'ग्यारह': '11',
  'बारह': '12',
  'तेरह': '13',
  'चौदह': '14',
  'पंद्रह': '15',
  'सोलह': '16',
  'सत्रह': '17',
  'अठारह': '18',
  'उन्नीस': '19',
  'बीस': '20',
  'पच्चीस': '25',
  'पचास': '50',
  'सौ': '100',
  'आधा': '0.5',
  'डेढ़': '1.5',
  'ढाई': '2.5',
  'सवा': '1.25',
  'पौने': '0.75',

  // --- Roman Hindi Number Words & Fractions ---
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
  sawa: '1.25',
  paune: '0.75',

  // --- English Number Words ---
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

// Unit variations across English, Roman Hindi, and Devanagari Hindi
export const UNIT_VARIATIONS = {
  // --- Weight (Canonical: 'kg', 'g') ---
  kg: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  kgs: 'kg',
  'किलो': 'kg',
  'किलोग्राम': 'kg',
  'किग्रा': 'kg',
  'केज़ी': 'kg',
  'केजी': 'kg',

  g: 'g',
  gram: 'g',
  grams: 'g',
  gm: 'g',
  gms: 'g',
  'ग्राम': 'g',
  'ग्रा': 'g',
  'जीएम': 'g',

  // --- Volume (Canonical: 'litre', 'ml') ---
  litre: 'litre',
  liter: 'litre',
  litres: 'litre',
  liters: 'litre',
  l: 'litre',
  ltr: 'litre',
  ltrs: 'litre',
  'लीटर': 'litre',
  'लिटर': 'litre',
  'ली': 'litre',

  ml: 'ml',
  mls: 'ml',
  millilitre: 'ml',
  milliliter: 'ml',
  'मिली': 'ml',
  'एमएल': 'ml',
  'मिलीलीटर': 'ml',

  // --- Packaging & Counts (Canonical: 'packet', 'piece', 'box', 'bottle') ---
  packet: 'packet',
  packets: 'packet',
  pkt: 'packet',
  pkts: 'packet',
  pouch: 'packet',
  pouches: 'packet',
  pack: 'packet',
  packs: 'packet',
  'पैकेट': 'packet',
  'पैकेट्स': 'packet',
  'पैक': 'packet',
  'पाउच': 'packet',
  'पुड़िया': 'packet',

  piece: 'piece',
  pieces: 'piece',
  pc: 'piece',
  pcs: 'piece',
  'पीस': 'piece',
  'नग': 'piece',
  'टुकड़ा': 'piece',

  box: 'box',
  boxes: 'box',
  dabba: 'box',
  dibba: 'box',
  'डिब्बा': 'box',
  'डब्बा': 'box',
  'बॉक्स': 'box',

  bottle: 'bottle',
  bottles: 'bottle',
  'बोतल': 'bottle',
};

// Common Indian retail conversational fillers, honorifics, and retail verbs
export const FILLER_WORDS = [
  // Devanagari Hindi fillers & verbs
  'अरे',
  'भैया',
  'भाई',
  'भाईजी',
  'अंकल',
  'जी',
  'साहब',
  'कृपया',
  'प्लीज',
  'जरा',
  'ज़रा',
  'थोड़ा',
  'थोड़ी',
  'कुछ',
  'मुझे',
  'हमें',
  'हमको',
  'देना',
  'दे दो',
  'दे दीजिए',
  'दे देना',
  'दे दो भैया',
  'चाहिए',
  'कर दो',
  'कर देना',
  'पैक कर दो',
  'डाल दो',
  'डाल देना',
  'लाना',
  'लाओ',
  'भेजो',
  'भेज दो',
  'लगा दो',
  'लगा देना',

  // Roman Hindi fillers & verbs
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

// Genitive connectors linking product & unit (e.g. "maggi ka packet", "packets of maggi")
export const CONNECTORS = ['का', 'के', 'की', 'ka', 'ke', 'ki', 'of'];

/**
 * Creates a regular expression that matches a whole word across Latin and Unicode/Devanagari scripts.
 * Standard \b only matches [A-Za-z0-9_] and fails on Devanagari.
 * This helper matches boundary transitions between word characters (letters/marks/numbers) and non-word characters.
 *
 * @param {string} word - The word or phrase to match
 * @param {string} [flags='giu'] - Regex flags
 * @returns {RegExp}
 */
export const createUnicodeWordRegex = (word, flags = 'giu') => {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}])${escaped}(?=[^\\p{L}\\p{M}\\p{N}]|$)`, flags);
};

/**
 * Normalizes customer transcript:
 * Trims whitespace, converts Devanagari numerals to ASCII digits, replaces dandas with commas,
 * cleans redundant punctuation, lowercases while preserving original
 * @param {string} text
 * @returns {string}
 */
export const normalizeText = (text) => {
  if (!text || typeof text !== 'string') return '';

  return text
    .toLowerCase()
    // Replace Devanagari digits with ASCII digits
    .replace(/[०-९]/g, (ch) => DEVANAGARI_DIGITS[ch] || ch)
    // Replace Devanagari danda punctuation with comma
    .replace(/[।॥]/g, ',')
    // Replace multiple spaces/newlines with single space
    .replace(/\s+/g, ' ')
    // Normalize dashes and quotes
    .replace(/[–—]/g, '-')
    .replace(/["']/g, '')
    .trim();
};

/**
 * Converts spelled-out Hindi (Devanagari & Roman) and English number words to digits
 * @param {string} text
 * @returns {string}
 */
export const replaceNumberWords = (text) => {
  if (!text) return '';

  let result = text;

  // 1. Convert Devanagari digits to ASCII digits
  result = result.replace(/[०-९]/g, (ch) => DEVANAGARI_DIGITS[ch] || ch);

  // 2. Sort words by length descending so multi-character phrases match first
  const sortedWords = Object.entries(NUMBER_WORDS).sort(([a], [b]) => b.length - a.length);

  for (const [word, digit] of sortedWords) {
    const regex = createUnicodeWordRegex(word);
    result = result.replace(regex, `$1${digit}`);
  }

  return result;
};

/**
 * Normalizes a raw unit string into its canonical representation
 * Supports English, Roman Hindi, and Devanagari Hindi units
 * @param {string} rawUnit
 * @returns {string|null}
 */
export const normalizeUnit = (rawUnit) => {
  if (!rawUnit) return null;
  const clean = rawUnit.toLowerCase().trim();
  return UNIT_VARIATIONS[clean] || clean;
};

/**
 * Cleans conversational fillers, honorifics, and retail verbs from a text segment
 * Works across Devanagari Hindi and English/Hinglish
 * @param {string} text
 * @returns {string}
 */
export const cleanConversationalFillers = (text) => {
  if (!text) return '';

  let cleaned = text;

  // Protect brand names containing "जी" / "ji" like "पारले जी" / "parle ji"
  cleaned = cleaned
    .replace(/(पारले)\s+(जी)/giu, '$1__JI__')
    .replace(/(parle)\s+(ji)/giu, '$1__JI__');

  // Sort fillers by length descending so multi-word phrases match first
  const sortedFillers = [...FILLER_WORDS].sort((a, b) => b.length - a.length);

  for (const filler of sortedFillers) {
    const regex = createUnicodeWordRegex(filler);
    cleaned = cleaned.replace(regex, '$1 ');
  }

  // Restore protected brand names
  cleaned = cleaned
    .replace(/(पारले)__JI__/giu, '$1 जी')
    .replace(/(parle)__JI__/giu, '$1 ji');

  // Remove leading/trailing punctuation and extra whitespace
  return cleaned
    .replace(/^[,.!?\-\\s।॥]+|[,.!?\-\\s।॥]+$/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
};
