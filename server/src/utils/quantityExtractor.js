/**
 * Quantity, Unit, and Product Segment Extractor
 * Identifies item boundaries and extracts quantities, units, and product phrases
 */

import {
  replaceNumberWords,
  normalizeUnit,
  cleanConversationalFillers,
  UNIT_VARIATIONS,
} from './textNormalizer.js';

/**
 * Splits raw transcript into individual item candidate segments
 * Unified across Hindi (Devanagari), English, and Hinglish
 * @param {string} transcript
 * @returns {Array<string>}
 */
export const splitIntoItemSegments = (transcript) => {
  if (!transcript || typeof transcript !== 'string') return [];

  // Normalize dandas, semicolons, newlines to commas
  let preprocessed = transcript.replace(/[;\n।॥]/g, ',');

  // Conjunction phrases (e.g. "aur bhi", "और भी", "साथ में")
  preprocessed = preprocessed
    .replace(/(?:^|[^\p{L}\p{M}\p{N}])(?:aur\s+bhi|saath\s+mein|sath\s+me|sath\s+mein|और\s+भी|साथ\s+में)(?=[^\p{L}\p{M}\p{N}]|$)/giu, ', ')
    // Single conjunction words: "aur", "and", "tatha", "plus", "also", "और", "तथा", "एवं", "व"
    .replace(/(?:^|[^\p{L}\p{M}\p{N}])(?:aur|and|tatha|plus|also|और|तथा|एवं|व)(?=[^\p{L}\p{M}\p{N}]|$)/giu, ', ');

  // Split by comma
  const rawSegments = preprocessed.split(',');

  const segments = [];
  for (const raw of rawSegments) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Check if a segment contains multiple items joined without commas (e.g. "2 kilo atta 1 litre oil")
    // Detect numbers appearing later in the segment preceded by a space
    const subSegments = splitMultiNumberSegment(trimmed);
    for (const sub of subSegments) {
      if (sub.trim()) {
        segments.push(sub.trim());
      }
    }
  }

  return segments;
};

/**
 * Splits a segment if it has multiple quantities chained without punctuation
 * e.g. "2 kilo atta 1 litre oil" -> ["2 kilo atta", "1 litre oil"]
 * Supports Devanagari and Latin characters
 * @param {string} segment
 * @returns {Array<string>}
 */
const splitMultiNumberSegment = (segment) => {
  // Convert spelled-out number words in a copy to detect positions
  const withDigits = replaceNumberWords(segment);

  // Separate attached numbers and units like "2kg" -> "2 kg", "2किलो" -> "2 किलो"
  const spacedDigits = withDigits
    .replace(/(\d+(?:\.\d+)?)([\p{L}\p{M}]+)/gu, '$1 $2')
    .replace(/([\p{L}\p{M}]+)(\d+(?:\.\d+)?)/gu, '$1 $2');

  // Only attempt splitting if there are 2 or more distinct quantities in the segment
  const numberMatches = spacedDigits.match(/\b\d+(?:\.\d+)?\b/g);
  if (!numberMatches || numberMatches.length <= 1) {
    return [segment];
  }

  // Match boundaries where a number follows a word
  const splitRegex = /(?<=[\p{L}\p{M}\s])\s+(?=\d+(?:\.\d+)?\s+[\p{L}\p{M}]+)/u;
  const parts = spacedDigits.split(splitRegex);

  return parts.length > 1 ? parts : [segment];
};

/**
 * Parses an individual item segment into quantity, unit, and product name
 * Fully multilingual across Hindi (Devanagari), English, and Hinglish
 * @param {string} rawSegment
 * @returns {object} { originalText, quantity, unit, productPhrase, isFillerOnly }
 */
export const parseItemSegment = (rawSegment) => {
  const originalText = rawSegment.trim();

  // 1. Convert number words to digits
  let workingText = replaceNumberWords(originalText);

  // 2. Separate attached numbers and letters/marks (e.g. "2kg" -> "2 kg", "500gm" -> "500 gm", "2किलो" -> "2 किलो")
  workingText = workingText
    .replace(/(\d+(?:\.\d+)?)([\p{L}\p{M}]+)/gu, '$1 $2')
    .replace(/([\p{L}\p{M}]+)(\d+(?:\.\d+)?)/gu, '$1 $2');

  // 3. Clean conversational fillers and trailing punctuation
  workingText = cleanConversationalFillers(workingText);

  // If after cleaning, nothing meaningful remains (was purely greeting/filler like "bhaiya")
  if (!workingText || workingText.length === 0) {
    return {
      originalText,
      quantity: null,
      unit: null,
      productPhrase: null,
      isFillerOnly: true,
    };
  }

  // Remove vague quantity words like "some", "thoda", "kuch", "zara", "थोड़ा", "कुछ", "ज़रा"
  workingText = workingText
    .replace(/(?:^|[^\p{L}\p{M}\p{N}])(?:some|thoda|kuch|zara|थोड़ा|थोड़ी|कुछ|ज़रा|जरा)(?=[^\p{L}\p{M}\p{N}]|$)/giu, ' ')
    .trim();

  // Optional connector pattern: ka, ke, ki, of, का, के, की
  const CONNECTOR_OPTIONAL = '(?:(?:ka|ke|ki|of|का|के|की)\\s+)?';

  // Pattern A: <quantity> <unit> [connector] <product>
  // e.g. "2 kilo atta", "1 litre sunflower oil", "दो किलो आटा", "1 litre of sunflower oil", "3 packet of maggi"
  const patternA = new RegExp(`^(\\d+(?:\\.\\d+)?)\\s+([^\\s]+)\\s+${CONNECTOR_OPTIONAL}(.+)$`, 'u');
  const matchA = workingText.match(patternA);
  if (matchA) {
    const [, qtyStr, possibleUnit, productPart] = matchA;
    if (isKnownUnit(possibleUnit)) {
      return {
        originalText,
        quantity: qtyStr,
        unit: normalizeUnit(possibleUnit),
        productPhrase: cleanProductPhrase(productPart),
        isFillerOnly: false,
      };
    }
  }

  // Pattern B: <quantity> <product> [connector] <unit>
  // e.g. "2 milk packets", "3 maggi packet", "तीन मैगी का पैकेट", "3 maggi ka packet"
  const patternB = new RegExp(`^(\\d+(?:\\.\\d+)?)\\s+(.+?)\\s+${CONNECTOR_OPTIONAL}([^\\s]+)$`, 'u');
  const matchB = workingText.match(patternB);
  if (matchB) {
    const [, qtyStr, productPart, possibleUnit] = matchB;
    if (isKnownUnit(possibleUnit)) {
      // Check if productPart + possibleUnit is actually a composite product name (e.g. "parle g", "पारले जी")
      const candidateFull = `${productPart} ${possibleUnit}`.trim().toLowerCase();
      if (
        candidateFull === 'parle g' ||
        candidateFull === 'parle-g' ||
        candidateFull === 'पारले जी' ||
        candidateFull === 'पारले-जी'
      ) {
        return {
          originalText,
          quantity: qtyStr,
          unit: null,
          productPhrase: cleanProductPhrase(candidateFull),
          isFillerOnly: false,
        };
      }

      return {
        originalText,
        quantity: qtyStr,
        unit: normalizeUnit(possibleUnit),
        productPhrase: cleanProductPhrase(productPart),
        isFillerOnly: false,
      };
    }
  }

  // Pattern C: <quantity> <product> (unit omitted, e.g. "3 maggi", "2 parle g", "3 मैगी")
  const patternC = /^(\d+(?:\.\d+)?)\s+(.+)$/u;
  const matchC = workingText.match(patternC);
  if (matchC) {
    const [, qtyStr, productPart] = matchC;
    // Check if productPart is just a unit (meaning product is missing, e.g. "2 packets", "२ पैकेट")
    if (isKnownUnit(productPart)) {
      return {
        originalText,
        quantity: qtyStr,
        unit: normalizeUnit(productPart),
        productPhrase: null, // Missing product!
        isFillerOnly: false,
      };
    }

    return {
      originalText,
      quantity: qtyStr,
      unit: null, // Unit not explicitly stated
      productPhrase: cleanProductPhrase(productPart),
      isFillerOnly: false,
    };
  }

  // Pattern D: <product> [connector] <quantity> [unit] (e.g. "atta 2 kg", "oil 1 litre", "दूध 1 लीटर", "मैगी के 3 पैकेट")
  const patternD = new RegExp(`^(.+?)\\s+${CONNECTOR_OPTIONAL}(\\d+(?:\\.\\d+)?)(?:\\s+([^\\s]+))?$`, 'u');
  const matchD = workingText.match(patternD);
  if (matchD) {
    const [, productPart, qtyStr, possibleUnit] = matchD;
    return {
      originalText,
      quantity: qtyStr,
      unit: possibleUnit && isKnownUnit(possibleUnit) ? normalizeUnit(possibleUnit) : null,
      productPhrase: cleanProductPhrase(productPart),
      isFillerOnly: false,
    };
  }

  // Pattern E: Just a standalone quantity (e.g. "2", "दो") with no product or unit
  const patternE = /^(\d+(?:\.\d+)?)$/u;
  const matchE = workingText.match(patternE);
  if (matchE) {
    return {
      originalText,
      quantity: matchE[1],
      unit: null,
      productPhrase: null,
      isFillerOnly: false,
    };
  }

  // Pattern F: Just a product with no quantity (e.g. "give me some milk" -> "milk", "दूध देना" -> "दूध")
  // Quantity is missing!
  return {
    originalText,
    quantity: null,
    unit: null,
    productPhrase: cleanProductPhrase(workingText),
    isFillerOnly: false,
  };
};

/**
 * Checks if a word is a known unit
 * @param {string} word
 * @returns {boolean}
 */
const isKnownUnit = (word) => {
  if (!word) return false;
  return Boolean(UNIT_VARIATIONS[word.toLowerCase().trim()]);
};

/**
 * Cleans punctuation, excess spaces, and residual connectors from product phrase
 * @param {string} phrase
 * @returns {string}
 */
const cleanProductPhrase = (phrase) => {
  if (!phrase) return null;
  let cleaned = cleanConversationalFillers(phrase);
  // Strip leading and trailing genitive connectors: ka, ke, ki, of, का, के, की
  cleaned = cleaned
    .replace(/^(?:का|के|की|ka|ke|ki|of)\s+/giu, '')
    .replace(/\s+(?:का|के|की|ka|ke|ki|of)$/giu, '')
    .replace(/^[-–—,.!?।॥\s]+|[-–—,.!?।॥\s]+$/gu, '')
    .trim();
  return cleaned.length > 0 ? cleaned : null;
};

