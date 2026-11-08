/**
 * Product Matcher Utility
 * Dynamically matches extracted customer product phrases against the PostgreSQL product catalogue
 * Supports exact matching, token overlap, alias dictionary resolution, and Levenshtein similarity
 */

import { findVocabularyMatch, findBrandMatch } from '../config/aliases.js';

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
  const queryTokens = query.toLowerCase().split(/[\s-]+/).filter(t => t.length > 1);
  const targetTokens = target.toLowerCase().split(/[\s-]+/).filter(t => t.length > 1);

  if (queryTokens.length === 0 || targetTokens.length === 0) return 0;

  let matchCount = 0;
  for (const qToken of queryTokens) {
    // Check exact token or very close spelling in target tokens
    const found = targetTokens.some(tToken => {
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
  if (!productPhrase || catalogueProducts.length === 0) {
    return {
      status: 'UNMATCHED',
      product: null,
      confidence: 0,
      candidates: [],
      defaultUnit: null,
    };
  }

  const cleanQuery = productPhrase.toLowerCase().trim();
  const aliasMatch = findVocabularyMatch(cleanQuery);

  const scoredProducts = [];

  for (const product of catalogueProducts) {
    const prodName = product.name.toLowerCase();
    const prodBrand = (product.brand || '').toLowerCase();
    const prodDesc = (product.description || '').toLowerCase();
    const prodCategory = (product.category || '').toLowerCase();

    let score = 0;

    // 1. Exact match against product name
    if (cleanQuery === prodName) {
      score = 1.0;
    }
    // 2. Substring match
    else if (prodName.includes(cleanQuery) || cleanQuery.includes(prodName)) {
      score = 0.88;
    }
    // 3. Alias dictionary resolution
    if (aliasMatch) {
      const allTargetTermsMatch = aliasMatch.targetTerms.every(term =>
        prodName.includes(term) || prodBrand.includes(term) || prodCategory.includes(term) || prodDesc.includes(term)
      );
      if (allTargetTermsMatch) {
        score = Math.max(score, 0.92);
      } else {
        const someTargetTermsMatch = aliasMatch.targetTerms.some(term =>
          prodName.includes(term) || prodBrand.includes(term) || prodDesc.includes(term)
        );
        if (someTargetTermsMatch) {
          score = Math.max(score, 0.78);
        }
      }
    }

    // 4. Token overlap score
    const tokenScore = calculateTokenOverlap(cleanQuery, prodName);
    if (tokenScore > 0) {
      score = Math.max(score, tokenScore * 0.85);
    }

    // 5. Levenshtein fuzzy string similarity (useful for typos like "magi", "ashirvaad")
    const nameSimilarity = calculateSimilarity(cleanQuery, prodName);
    if (nameSimilarity >= 0.75) {
      score = Math.max(score, nameSimilarity * 0.90);
    }

    // Check brand similarity (supporting English and Devanagari Hindi brand aliases)
    const brandAlias = findBrandMatch(cleanQuery);
    if (brandAlias && prodBrand === brandAlias) {
      score = Math.max(score, 0.85);
    } else if (prodBrand) {
      const brandSimilarity = calculateSimilarity(cleanQuery, prodBrand);
      if (brandSimilarity >= 0.80) {
        score = Math.max(score, brandSimilarity * 0.75);
      }
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
    // If difference between top and second is very small (< 0.08) and both >= 0.70
    if (Math.abs(topMatch.score - secondMatch.score) <= 0.08 && secondMatch.score >= 0.70) {
      return {
        status: 'AMBIGUOUS',
        product: null,
        confidence: topMatch.score,
        candidates: scoredProducts.slice(0, 3).map(c => c.product),
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
