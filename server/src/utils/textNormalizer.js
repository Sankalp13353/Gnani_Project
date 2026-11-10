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
  'तीस': '30',
  'चालीस': '40',
  'पचास': '50',
  'सौ': '100',
  'आधा': '0.5',
  'डेढ़': '1.5',
  'ढाई': '2.5',
  'सवा': '1.25',
  'पौने': '0.75',

  // --- Devanagari Transliterations of English Number Words ---
  'वन': '1',
  'टू': '2',
  'थ्री': '3',
  'फोर': '4',
  'फाइव': '5',
  'सिक्स': '6',
  'सेवन': '7',
  'एट': '8',
  'नाइन': '9',
  'टेन': '10',
  'इलेवन': '11',
  'ट्वेल्व': '12',
  'ट्वेलव': '12',
  'थर्टीन': '13',
  'फोर्टीन': '14',
  'फिफ्टीन': '15',
  'सिक्सटीन': '16',
  'सेवंटीन': '17',
  'एइटीन': '18',
  'नाइन्टीन': '19',
  'ट्वेंटी': '20',
  'थर्टी': '30',
  'फोर्ट्टी': '40',
  'फिफ्टी': '50',
  'हंड्रेड': '100',
  'हाफ': '0.5',

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
  eleven: '11',
  twelve: '12',
  thirteen: '13',
  fourteen: '14',
  fifteen: '15',
  sixteen: '16',
  seventeen: '17',
  eighteen: '18',
  nineteen: '19',
  twenty: '20',
  thirty: '30',
  forty: '40',
  fifty: '50',
  hundred: '100',
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
    .replace(/^[-–—,.!?।॥\s]+|[-–—,.!?।॥\s]+$/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// Consonants mapping for Devanagari to Latin transliteration
const DEVANAGARI_CONSONANTS = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f',
};

const DEVANAGARI_VOWELS = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
  'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o', 'ॲ': 'a',
};

const DEVANAGARI_MATRAS = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
  'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'a',
};

/**
 * Transliterates Devanagari script into Latin (Roman) phonetic characters.
 * Deterministic, reusable across any grocery or retail product.
 * @param {string} text
 * @returns {string}
 */
export const transliterateDevanagariToLatin = (text) => {
  if (!text || typeof text !== 'string') return '';

  let s = text
    .replace(/ाय/g, 'aay')
    .replace(/ाइ/g, 'aai')
    .replace(/ॉ/g, 'o')
    .replace(/ॅ/g, 'e');

  let out = '';
  const chars = [...s];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];

    let c = ch;
    if (next === '\u093c') {
      c = ch + next;
      i++;
    }

    if (DEVANAGARI_CONSONANTS[c]) {
      out += DEVANAGARI_CONSONANTS[c];
      const after = chars[i + 1];
      const isEndOfWord = !after || /[\s,.\-!?;:।॥]/.test(after);

      if (after === '्') {
        i++;
      } else if (after && DEVANAGARI_MATRAS[after]) {
        out += DEVANAGARI_MATRAS[after];
        i++;
      } else if (isEndOfWord) {
        // Final consonant of a word, schwa dropped
      } else if (after && DEVANAGARI_CONSONANTS[after]) {
        out += 'a';
      } else if (/[a-zA-Z]/.test(after)) {
        // Followed by Latin diphthong
      } else {
        out += 'a';
      }
    } else if (DEVANAGARI_VOWELS[ch]) {
      out += DEVANAGARI_VOWELS[ch];
    } else if (DEVANAGARI_MATRAS[ch]) {
      out += DEVANAGARI_MATRAS[ch];
    } else if (ch === 'ं' || ch === 'ँ') {
      out += 'n';
    } else if (ch === 'ः') {
      out += 'h';
    } else if (ch === '्') {
      // halant
    } else {
      out += ch;
    }
  }

  return out.replace(/\s+/g, ' ').trim();
};

/**
 * Normalizes an individual word phonetically (plurals, consonants, vowels, silent letters).
 * @param {string} w
 * @returns {string}
 */
export const normalizePhoneticWord = (w) => {
  if (!w) return '';
  let word = w.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

  // 1. Plural reduction at word boundaries
  if (word.endsWith('ies') && word.length > 4) word = word.slice(0, -3) + 'y';
  else if (word.endsWith('es') && word.length > 4 && !word.endsWith('ees')) word = word.slice(0, -2);
  else if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) word = word.slice(0, -1);

  // 2. Consonant normalization
  word = word
    .replace(/ck/g, 'k')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/c/g, 'k')
    .replace(/q/g, 'k')
    .replace(/ph/g, 'f')
    .replace(/w/g, 'v');

  // 3. Retail spelling normalizations (biscuit/biskit/biskut)
  word = word
    .replace(/bisc/g, 'bisk')
    .replace(/biskui/g, 'biski')
    .replace(/bisku/g, 'biski');

  // 4. Diphthongs for brand words like Tiger: taaygar / taaigar / taygar -> tiger
  word = word.replace(/^t(?:aay|aai|aaya|ay|ai)g/g, 'tig');

  // 5. Vowel normalizations
  word = word
    .replace(/ee|ea|ey/g, 'i')
    .replace(/oo|ou/g, 'u')
    .replace(/aa/g, 'a')
    .replace(/(?:ar|er)$/g, 'er');

  // 6. Collapse duplicate consonants
  word = word.replace(/([^aeiou])\1+/g, '$1');

  return word;
};

/**
 * Phonetically normalizes a phrase across Hindi (Devanagari), English, and Hinglish
 * @param {string} text
 * @returns {string}
 */
export const phoneticNormalize = (text) => {
  if (!text) return '';
  let latin = text;
  if (/[\u0900-\u097F]/.test(text)) {
    latin = transliterateDevanagariToLatin(text);
  }
  return latin
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(normalizePhoneticWord)
    .join(' ');
};
