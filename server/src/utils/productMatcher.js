/**
 * Product Matcher Utility
 * Dynamically matches extracted customer product phrases against the PostgreSQL product catalogue
 * Supports exact matching, token overlap, alias dictionary resolution, and Levenshtein similarity
 */

import { findVocabularyMatch, findBrandMatch } from '../config/aliases.js';
import {
  transliterateDevanagariToLatin,
  phoneticNormalize,
} from './textNormalizer.js';

/**
 * Calculates Levenshtein distance between two strings
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export const calculateLevenshteinDistance = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

/**
 * Calculates string similarity ratio between 0 and 1
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export const calculateSimilarity = (a, b) => {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1.0;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;

  const distance = calculateLevenshteinDistance(s1, s2);
  return Math.max(0, 1.0 - distance / maxLen);
};

/**
 * Calculates token overlap score between query and target
 * @param {string} query
 * @param {string} target
 * @returns {number}
 */
export const calculateTokenOverlap = (query, target) => {
  const queryTokens = query.toLowerCase().split(/[\s-]+/).filter((t) => t.length > 1);
  const targetTokens = target.toLowerCase().split(/[\s-]+/).filter((t) => t.length > 1);

  if (queryTokens.length === 0 || targetTokens.length === 0) return 0;

  let matchCount = 0;
  for (const qToken of queryTokens) {
    // Check exact token or very close spelling in target tokens
    const found = targetTokens.some((tToken) => {
      if (qToken === tToken) return true;
      if (calculateSimilarity(qToken, tToken) >= 0.80) return true;
      return false;
    });
    if (found) matchCount++;
  }

  return matchCount / queryTokens.length;
};

/**
 * Matches an extracted product phrase against a list of active catalogue products
 * @param {string} productPhrase
 * @param {Array<object>} catalogueProducts - Products from PostgreSQL
 * @returns {object} { status: 'MATCHED'|'AMBIGUOUS'|'UNMATCHED', product, confidence, candidates, defaultUnit }
 */
export const matchProductInCatalogue = (productPhrase, catalogueProducts = []) => {
  if (!productPhrase || !Array.isArray(catalogueProducts) || catalogueProducts.length === 0) {
    return {
      status: 'UNMATCHED',
      product: null,
      confidence: 0,
      candidates: [],
      defaultUnit: null,
    };
  }

  const cleanQuery = productPhrase.toLowerCase().trim();
  const latinQuery = /[\u0900-\u097F]/.test(cleanQuery)
    ? transliterateDevanagariToLatin(cleanQuery)
    : cleanQuery;
  const phoneticQuery = phoneticNormalize(cleanQuery);
  const phoneticTokens = phoneticQuery.split(/\s+/).filter(Boolean);

  // Check alias dictionary for colloquial query phrases
  const aliasMatch = findVocabularyMatch(cleanQuery) || (latinQuery !== cleanQuery ? findVocabularyMatch(latinQuery) : null);
  const brandAlias = findBrandMatch(cleanQuery) || (latinQuery !== cleanQuery ? findBrandMatch(latinQuery) : null);

  const scoredProducts = [];

  for (const product of catalogueProducts) {
    // Strictly guard against inactive or out-of-stock catalogue items
    if (product.isActive === false || product.isAvailable === false) {
      continue;
    }

    const prodName = product.name.toLowerCase();
    const prodBrand = (product.brand || '').toLowerCase();
    const prodCategory = (product.category || '').toLowerCase();
    const prodDesc = (product.description || '').toLowerCase();

    const prodNamePhonetic = phoneticNormalize(product.name);
    const prodBrandPhonetic = phoneticNormalize(product.brand || '');
    const prodPhoneticTokens = prodNamePhonetic.split(/\s+/).filter(Boolean);
    const prodBrandPhoneticTokens = prodBrandPhonetic.split(/\s+/).filter(Boolean);

    let score = 0;

    // 1. Exact match against product name (raw, transliterated, or phonetic)
    if (cleanQuery === prodName || latinQuery === prodName) {
      score = 1.0;
    } else if (phoneticQuery === prodNamePhonetic) {
      score = 0.96;
    }

    // Helper for boundary-aware subphrase matching
    const isWordSubphrase = (sub, full) => {
      if (!sub || !full || sub.length < 2) return false;
      const escaped = sub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'iu').test(full);
    };

    // 2. Boundary-aware subphrase match
    if (
      isWordSubphrase(cleanQuery, prodName) ||
      isWordSubphrase(prodName, cleanQuery) ||
      isWordSubphrase(latinQuery, prodName) ||
      isWordSubphrase(prodName, latinQuery)
    ) {
      score = Math.max(score, 0.88);
    } else if (
      isWordSubphrase(phoneticQuery, prodNamePhonetic) ||
      isWordSubphrase(prodNamePhonetic, phoneticQuery)
    ) {
      score = Math.max(score, 0.86);
    }

    // 3. Phonetic Token Coverage and Overlap
    if (phoneticTokens.length > 0 && prodPhoneticTokens.length > 0) {
      let matchedQueryTokens = 0;
      let matchedProdTokens = 0;

      for (const qToken of phoneticTokens) {
        const foundInName = prodPhoneticTokens.some((pToken) => {
          if (qToken === pToken) return true;
          if (calculateSimilarity(qToken, pToken) >= 0.80) return true;
          return false;
        });

        if (foundInName) {
          matchedQueryTokens++;
          matchedProdTokens++;
        } else if (prodBrandPhoneticTokens.length > 0) {
          const foundInBrand = prodBrandPhoneticTokens.some((bToken) => {
            if (qToken === bToken) return true;
            if (calculateSimilarity(qToken, bToken) >= 0.80) return true;
            return false;
          });
          if (foundInBrand) {
            matchedQueryTokens++;
          }
        }
      }

      const queryCoverage = matchedQueryTokens / phoneticTokens.length;
      const prodCoverage = matchedProdTokens / prodPhoneticTokens.length;

      // If every token in the query matched this product or its brand
      if (queryCoverage === 1.0) {
        if (prodCoverage === 1.0) {
          // Exact token equality across all product tokens (e.g. "tiger" + "biskit")
          score = Math.max(score, 0.95);
        } else {
          // Query covered all product tokens partially or was a brand/sub-name
          score = Math.max(score, 0.78 + (prodCoverage * 0.14));
        }
      } else if (phoneticTokens.length > 1 && queryCoverage < 1.0) {
        // Multi-token query where a distinctive token was NOT found in this product
        // (e.g. "tiger biscuit" query against "Parle-G Biscuits", or "oreo biscuit" against "Tiger Biscuit")
        // Severely penalize so unmatched brand/product names do not get falsely matched
        score = Math.max(score, queryCoverage * 0.40);
      } else {
        const partialScore = (queryCoverage * 0.60) + (prodCoverage * 0.25);
        score = Math.max(score, partialScore);
      }
    }

    // 4. Alias dictionary resolution
    if (aliasMatch) {
      const isDirectSynonymMatch = Boolean(
        aliasMatch.synonyms.includes(cleanQuery) || aliasMatch.synonyms.includes(latinQuery)
      );

      const allTargetTermsMatch = aliasMatch.targetTerms.every((term) =>
        prodName.includes(term) ||
        prodBrand.includes(term) ||
        prodCategory.includes(term) ||
        prodDesc.includes(term)
      );

      if (allTargetTermsMatch) {
        if (isDirectSynonymMatch) {
          score = Math.max(score, 0.92);
        } else if (score >= 0.70) {
          score = Math.max(score, 0.92);
        }
      } else {
        const someTargetTermsMatch = aliasMatch.targetTerms.some((term) =>
          prodName.includes(term) ||
          prodBrand.includes(term) ||
          prodCategory.includes(term) ||
          prodDesc.includes(term)
        );
        if (someTargetTermsMatch && isDirectSynonymMatch) {
          score = Math.max(score, 0.78);
        }
      }
    }

    // 5. Brand similarity (supporting English and Devanagari Hindi brand aliases)
    const effectiveBrand = brandAlias || findBrandMatch(cleanQuery) || findBrandMatch(latinQuery);
    if (effectiveBrand && prodBrand === effectiveBrand) {
      score = Math.max(score, 0.85);
    } else if (prodBrand) {
      const brandSim = Math.max(
        calculateSimilarity(cleanQuery, prodBrand),
        calculateSimilarity(latinQuery, prodBrand),
        calculateSimilarity(phoneticQuery, prodBrandPhonetic)
      );
      if (brandSim >= 0.80) {
        score = Math.max(score, brandSim * 0.75);
      }
    }

    // 6. Levenshtein fuzzy string similarity across representations
    const maxSim = Math.max(
      calculateSimilarity(cleanQuery, prodName),
      calculateSimilarity(latinQuery, prodName),
      calculateSimilarity(phoneticQuery, prodNamePhonetic)
    );
    if (maxSim >= 0.75) {
      score = Math.max(score, maxSim * 0.90);
    }

    if (score >= 0.65) {
      scoredProducts.push({
        product,
        score: Math.round(score * 100) / 100,
      });
    }
  }

  // Sort candidates by score descending
  scoredProducts.sort((a, b) => b.score - a.score);

  // If no candidates meet threshold
  if (scoredProducts.length === 0) {
    return {
      status: 'UNMATCHED',
      product: null,
      confidence: 0,
      candidates: [],
      defaultUnit: aliasMatch?.defaultUnit || null,
    };
  }

  const topMatch = scoredProducts[0];

  // Check for ambiguity: multiple candidates with close scores
  if (scoredProducts.length > 1) {
    const secondMatch = scoredProducts[1];
    // If difference between top and second is very small (<= 0.08) and both >= 0.70
    if (Math.abs(topMatch.score - secondMatch.score) <= 0.08 && secondMatch.score >= 0.70) {
      return {
        status: 'AMBIGUOUS',
        product: null,
        confidence: topMatch.score,
        candidates: scoredProducts.slice(0, 3).map((c) => c.product),
        defaultUnit: aliasMatch?.defaultUnit || null,
      };
    }
  }

  // Confident single match
  if (topMatch.score >= 0.70) {
    return {
      status: 'MATCHED',
      product: topMatch.product,
      confidence: topMatch.score,
      candidates: [topMatch.product],
      defaultUnit: aliasMatch?.defaultUnit || topMatch.product.unit,
    };
  }

  // Score was below confidence threshold
  return {
    status: 'UNMATCHED',
    product: null,
    confidence: topMatch.score,
    candidates: [],
    defaultUnit: aliasMatch?.defaultUnit || null,
  };
};
