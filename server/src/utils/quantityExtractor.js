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
import { findVocabularyMatch } from '../config/aliases.js';

/**
 * Splits raw transcript into individual item candidate segments
 * @param {string} transcript
 * @returns {Array<string>}
 */
export const splitIntoItemSegments = (transcript) => {
  if (!transcript || typeof transcript !== 'string') return [];

  // Normalize number words first so "aur ek" doesn't get confused
  const preprocessed = transcript
    .replace(/[;\n]/g, ',')
    // Conjunctions representing item splits
    .replace(/\b(aur\s+ek|aur\s+bhi|saath\s+mein|sath\s+me|sath\s+mein)\b/gi, ',')
    .replace(/\b(aur|and|tatha|plus|also)\b/gi, ',');

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
 * @param {string} segment
 * @returns {Array<string>}
 */
const splitMultiNumberSegment = (segment) => {
  // Convert spelled-out number words in a copy to detect positions
  const withDigits = replaceNumberWords(segment);

  // Separate attached numbers and units like "2kg" -> "2 kg"
  const spacedDigits = withDigits.replace(/(\d+(?:\.\d+)?)([a-zA-Z]+)/g, '$1 $2');

  // Match boundaries where a number follows a word
  const splitRegex = /(?<=[a-zA-Z\s])\s+(?=\d+(?:\.\d+)?\s+[a-zA-Z]+)/;
  const parts = spacedDigits.split(splitRegex);

  return parts.length > 1 ? parts : [segment];
};

/**
 * Parses an individual item segment into quantity, unit, and product name
 * @param {string} rawSegment
 * @returns {object} { originalText, quantity, unit, productPhrase, isFillerOnly }
 */
export const parseItemSegment = (rawSegment) => {
  const originalText = rawSegment.trim();

  // 1. Convert number words to digits
  let workingText = replaceNumberWords(originalText);

  // 2. Separate attached numbers and letters (e.g. "2kg" -> "2 kg", "500gm" -> "500 gm")
  workingText = workingText.replace(/(\d+(?:\.\d+)?)([a-zA-Z]+)/g, '$1 $2');

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

  // Remove vague quantity words like "some", "thoda", "kuch"
  workingText = workingText.replace(/\b(some|thoda|kuch|zara)\b/gi, '').trim();

  // Pattern A: <quantity> <unit> <product> (e.g. "2 kilo atta", "1 litre sunflower oil")
  const patternA = /^(\d+(?:\.\d+)?)\s+([a-zA-Z]+)\s+(.+)$/i;
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

  // Pattern B: <quantity> <product> <unit> (e.g. "2 milk packets", "3 maggi packet")
  const patternB = /^(\d+(?:\.\d+)?)\s+(.+?)\s+([a-zA-Z]+)$/i;
  const matchB = workingText.match(patternB);
  if (matchB) {
    const [, qtyStr, productPart, possibleUnit] = matchB;
    if (isKnownUnit(possibleUnit)) {
      // Check if productPart + possibleUnit is actually a composite product name (e.g. "parle g")
      const candidateFull = `${productPart} ${possibleUnit}`.trim().toLowerCase();
      if (candidateFull === 'parle g' || candidateFull === 'parle-g' || findVocabularyMatch(candidateFull)) {
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

  // Pattern C: <quantity> <product> (unit omitted, e.g. "3 maggi", "2 parle g")
  const patternC = /^(\d+(?:\.\d+)?)\s+(.+)$/i;
  const matchC = workingText.match(patternC);
  if (matchC) {
    const [, qtyStr, productPart] = matchC;
    // Check if productPart is just a unit (meaning product is missing)
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

  // Pattern D: <product> <quantity> <unit> (e.g. "atta 2 kg", "oil 1 litre")
  const patternD = /^(.+?)\s+(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/i;
  const matchD = workingText.match(patternD);
  if (matchD) {
    const [, productPart, qtyStr, possibleUnit] = matchD;
    return {
      originalText,
      quantity: qtyStr,
      unit: possibleUnit ? normalizeUnit(possibleUnit) : null,
      productPhrase: cleanProductPhrase(productPart),
      isFillerOnly: false,
    };
  }

  // Pattern E: Just a product with no quantity (e.g. "give me some milk" -> "milk")
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
 * Cleans punctuation and excess spaces from product phrase
 * @param {string} phrase
 * @returns {string}
 */
const cleanProductPhrase = (phrase) => {
  if (!phrase) return null;
  const cleaned = cleanConversationalFillers(phrase);
  return cleaned.length > 0 ? cleaned : null;
};

