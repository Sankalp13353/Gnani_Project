/**
 * Product Aliases and Colloquial Vocabulary Mapping
 * Maintains common Indian Kirana term equivalents in Hindi, English, and Hinglish.
 * Decoupled from core parsing logic so new vocabulary can be registered easily.
 */

export const PRODUCT_VOCABULARY = [
  {
    key: 'wheat_flour',
    synonyms: ['atta', 'aata', 'aashirvaad atta', 'ashirvad atta', 'gehu ka atta', 'wheat flour', 'flour'],
    targetTerms: ['aashirvaad', 'atta'],
    category: 'Staples & Grains',
    defaultUnit: 'kg',
  },
  {
    key: 'milk',
    synonyms: ['milk', 'doodh', 'dudh', 'taaza milk', 'amul taaza', 'amul milk', 'toned milk'],
    targetTerms: ['amul', 'taaza', 'milk'],
    category: 'Dairy',
    defaultUnit: 'packet',
  },
  {
    key: 'salt',
    synonyms: ['salt', 'namak', 'tata salt', 'tata namak', 'iodised salt'],
    targetTerms: ['tata', 'salt'],
    category: 'Staples & Spices',
    defaultUnit: '1kg',
  },
  {
    key: 'sugar',
    synonyms: ['sugar', 'cheeni', 'chini', 'shakkar', 'shakar'],
    targetTerms: ['sugar'],
    category: 'Staples & Sweeteners',
    defaultUnit: 'kg',
  },
  {
    key: 'cooking_oil',
    synonyms: ['oil', 'sunflower oil', 'cooking oil', 'tel', 'meetha tel', 'fortune oil', 'fortune sunflower oil'],
    targetTerms: ['fortune', 'sunflower', 'oil'],
    category: 'Edible Oils',
    defaultUnit: 'litre',
  },
  {
    key: 'instant_noodles',
    synonyms: ['maggi', 'maggie', 'magi', 'noodles', 'maggi noodles', 'masala noodles'],
    targetTerms: ['maggi', 'noodles'],
    category: 'Instant Food & Snacks',
    defaultUnit: 'packet',
  },
  {
    key: 'biscuits',
    synonyms: ['biscuit', 'biscuits', 'biskoot', 'parle g', 'parle-g', 'parleg', 'parle biscuit', 'glucose biscuit'],
    targetTerms: ['parle-g', 'biscuits', 'parle'],
    category: 'Biscuits & Cookies',
    defaultUnit: 'packet',
  },
  {
    key: 'butter',
    synonyms: ['butter', 'makkhan', 'makhan', 'amul butter', 'table butter'],
    targetTerms: ['amul', 'butter'],
    category: 'Dairy',
    defaultUnit: '100g',
  },
];

/**
 * Searches the vocabulary for a colloquial phrase
 * @param {string} phrase
 * @returns {object|null}
 */
export const findVocabularyMatch = (phrase) => {
  if (!phrase) return null;
  const normalized = phrase.toLowerCase().trim();

  // 1. Direct synonym match
  for (const entry of PRODUCT_VOCABULARY) {
    if (entry.synonyms.includes(normalized)) {
      return entry;
    }
  }

  // 2. Word boundary / substring match
  for (const entry of PRODUCT_VOCABULARY) {
    for (const syn of entry.synonyms) {
      if (normalized === syn || normalized.includes(syn) || syn.includes(normalized)) {
        return entry;
      }
    }
  }

  return null;
};

