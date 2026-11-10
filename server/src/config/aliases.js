/**
 * Product Aliases and Colloquial Vocabulary Mapping
 * Maintains common Indian retail term equivalents in Hindi (Devanagari), English, and Hinglish.
 * Decoupled from core parsing logic so new vocabulary can be registered easily.
 */

import { createUnicodeWordRegex } from '../utils/textNormalizer.js';

export const PRODUCT_VOCABULARY = [
  {
    key: 'wheat_flour',
    synonyms: [
      'atta',
      'aata',
      'aashirvaad atta',
      'ashirvad atta',
      'gehu ka atta',
      'wheat flour',
      'flour',
      'आटा',
      'गेहूं का आटा',
      'गेहू का आटा',
      'आशीर्वाद आटा',
      'आशीर्वाद',
    ],
    targetTerms: ['aashirvaad', 'atta'],
    category: 'Staples & Grains',
    defaultUnit: 'kg',
  },
  {
    key: 'milk',
    synonyms: [
      'milk',
      'doodh',
      'dudh',
      'taaza milk',
      'amul taaza',
      'amul milk',
      'toned milk',
      'दूध',
      'दोध',
      'अमुल दूध',
      'अमूल दूध',
      'अमुल ताजा',
      'अमूल ताजा',
      'ताजा दूध',
    ],
    targetTerms: ['amul', 'taaza', 'milk'],
    category: 'Dairy',
    defaultUnit: 'packet',
  },
  {
    key: 'salt',
    synonyms: [
      'salt',
      'namak',
      'tata salt',
      'tata namak',
      'iodised salt',
      'नमक',
      'टाटा नमक',
      'टाटा साल्ट',
      'साल्ट',
    ],
    targetTerms: ['tata', 'salt'],
    category: 'Staples & Spices',
    defaultUnit: '1kg',
  },
  {
    key: 'sugar',
    synonyms: [
      'sugar',
      'cheeni',
      'chini',
      'shakkar',
      'shakar',
      'चीनी',
      'चीनि',
      'शक्कर',
      'शकर',
    ],
    targetTerms: ['sugar'],
    category: 'Staples & Sweeteners',
    defaultUnit: 'kg',
  },
  {
    key: 'cooking_oil',
    synonyms: [
      'oil',
      'sunflower oil',
      'cooking oil',
      'tel',
      'meetha tel',
      'fortune oil',
      'fortune sunflower oil',
      'सनफ्लावर ऑयल',
      'सनफ्लावर तेल',
      'फॉर्च्यून ऑयल',
      'फॉर्च्यून तेल',
      'फॉर्च्यून सनफ्लावर ऑयल',
      'कुकिंग ऑयल',
      'ऑयल',
      'तेल',
    ],
    targetTerms: ['fortune', 'sunflower', 'oil'],
    category: 'Edible Oils',
    defaultUnit: 'litre',
  },
  {
    key: 'instant_noodles',
    synonyms: [
      'maggi',
      'maggie',
      'magi',
      'noodles',
      'maggi noodles',
      'masala noodles',
      'मैगी',
      'मैगी नूडल्स',
      'मसाला नूडल्स',
      'नूडल्स',
    ],
    targetTerms: ['maggi', 'noodles'],
    category: 'Instant Food & Snacks',
    defaultUnit: 'packet',
  },
  {
    key: 'biscuits',
    synonyms: [
      'biscuit',
      'biscuits',
      'biskoot',
      'बिस्कुट',
      'बिस्किट',
      'ग्लूकोज बिस्कुट',
    ],
    targetTerms: ['biscuit', 'biscuits'],
    category: 'Biscuits & Cookies',
    defaultUnit: 'packet',
  },
  {
    key: 'parle_g',
    synonyms: [
      'parle g',
      'parle-g',
      'parleg',
      'parle biscuit',
      'glucose biscuit',
      'पारले जी',
      'पारले-जी',
      'पारले',
    ],
    targetTerms: ['parle-g', 'biscuits', 'parle'],
    category: 'Biscuits & Cookies',
    defaultUnit: 'packet',
  },
  {
    key: 'butter',
    synonyms: [
      'butter',
      'makkhan',
      'makhan',
      'amul butter',
      'table butter',
      'मक्खन',
      'मखन',
      'अमुल बटर',
      'अमूल बटर',
      'बटर',
      'टेबल बटर',
    ],
    targetTerms: ['amul', 'butter'],
    category: 'Dairy',
    defaultUnit: '100g',
  },
];

// Multilingual Brand Aliases across Hindi (Devanagari) and English
export const BRAND_ALIASES = {
  'अमुल': 'amul',
  'अमूल': 'amul',
  'amul': 'amul',
  'आशीर्वाद': 'aashirvaad',
  'aashirvaad': 'aashirvaad',
  'ashirvad': 'aashirvaad',
  'टाटा': 'tata',
  'tata': 'tata',
  'फॉर्च्यून': 'fortune',
  'फॉर्च्युन': 'fortune',
  'fortune': 'fortune',
  'पारले': 'parle',
  'parle': 'parle',
  'नेस्ले': 'nestle',
  'nestle': 'nestle',
  'टाइगर': 'tiger',
  'टायगर': 'tiger',
  'tiger': 'tiger',
  'ब्रिटानिया': 'britannia',
  'britannia': 'britannia',
};

/**
 * Resolves a brand name in Hindi or English to canonical lowercased brand
 * @param {string} phrase
 * @returns {string|null}
 */
export const findBrandMatch = (phrase) => {
  if (!phrase) return null;
  const clean = phrase.toLowerCase().trim();
  return BRAND_ALIASES[clean] || null;
};

/**
 * Searches the vocabulary for a colloquial phrase
 * @param {string} phrase
 * @returns {object|null}
 */
export const findVocabularyMatch = (phrase) => {
  if (!phrase) return null;
  const normalized = phrase.toLowerCase().trim();

  // If the phrase is purely a brand name (e.g. "amul", "अमुल", "अमूल"), don't map to a specific product
  // Let the brand matcher resolve all candidate products for that brand
  if (findBrandMatch(normalized)) {
    return null;
  }

  // 1. Direct synonym match
  for (const entry of PRODUCT_VOCABULARY) {
    if (entry.synonyms.includes(normalized)) {
      return entry;
    }
  }

  // 2. Word boundary / substring match using Unicode-aware matching
  for (const entry of PRODUCT_VOCABULARY) {
    for (const syn of entry.synonyms) {
      if (normalized === syn) {
        return entry;
      }
      // Check if normalized contains syn as a whole word
      if (createUnicodeWordRegex(syn).test(normalized)) {
        return entry;
      }
      // Check if syn contains normalized as a whole word (only if query is meaningful length)
      if (normalized.length >= 3 && createUnicodeWordRegex(normalized).test(syn)) {
        return entry;
      }
    }
  }

  return null;
};


