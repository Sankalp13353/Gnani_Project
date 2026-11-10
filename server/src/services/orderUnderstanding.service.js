/**
 * Order Understanding Engine Service
 * Converts customer voice/text transcripts into structured draft orders
 * Integrates text preprocessing, quantity extraction, catalogue matching, unit conversion, and ambiguity resolution
 */

import prisma from '../config/prisma.js';
import { splitIntoItemSegments, parseItemSegment } from '../utils/quantityExtractor.js';
import { matchProductInCatalogue } from '../utils/productMatcher.js';
import { sumDecimals, formatCurrency } from '../utils/decimal.js';
import { calculateUnitConversion } from '../utils/unitConverter.js';
import { isValidUuid } from '../utils/productValidation.js';
import { logger } from '../utils/logger.js';

export const DEFAULT_STORE_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Parses customer transcript and returns a structured draft order
 * @param {string} transcript - Raw text transcript from customer
 * @param {object} [options]
 * @param {string} [options.storeId] - Store ID to scope product catalogue lookup
 * @param {boolean} [options.allowLegacyFallback] - Whether to allow DEFAULT_STORE_ID fallback for legacy linguistic tests
 * @returns {Promise<object>} Draft order data structure
 */
export const parseOrderTranscript = async (transcript, { storeId, allowLegacyFallback = (storeId === undefined) } = {}) => {
  if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
    const error = new Error('Transcript is required and must be a non-empty string');
    error.status = 400;
    throw error;
  }

  const rawTranscript = transcript.trim();
  let targetStoreId;

  // Case 1: storeId is missing
  if (!storeId) {
    if (allowLegacyFallback) {
      targetStoreId = DEFAULT_STORE_ID;
      logger.info(`Processing order transcript with legacy fallback store ${targetStoreId}`);
    } else {
      const error = new Error('Store ID is required');
      error.status = 400;
      throw error;
    }
  } else {
    // Case 2: storeId is provided - strictly validate UUID, existence, and open status
    if (!isValidUuid(storeId)) {
      const error = new Error('Invalid store ID format');
      error.status = 400;
      throw error;
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, name: true, isOpen: true },
    });

    if (!store) {
      const error = new Error('Store not found');
      error.status = 404;
      throw error;
    }

    if (!store.isOpen) {
      const error = new Error('Store is currently closed for orders');
      error.status = 400;
      throw error;
    }

    targetStoreId = store.id;
    logger.info(`Processing order transcript: "${rawTranscript}" for verified store "${store.name}" (${targetStoreId})`);
  }

  // 1. Fetch active and available products from the PostgreSQL catalogue (strictly scoped to target store)
  const catalogueProducts = await prisma.product.findMany({
    where: {
      isActive: true,
      isAvailable: true,
      storeId: targetStoreId,
    },
    select: {
      id: true,
      storeId: true,
      name: true,
      brand: true,
      category: true,
      unit: true,
      price: true,
      description: true,
      isActive: true,
      isAvailable: true,
    },
  });

  // 2. Segment transcript into discrete item candidates
  const candidateSegments = splitIntoItemSegments(rawTranscript);

  const parsedItems = [];
  const clarificationQuestions = [];

  for (const segment of candidateSegments) {
    const parsedSegment = parseItemSegment(segment);

    // Skip segments that were purely greetings or fillers (e.g. "bhaiya")
    if (parsedSegment.isFillerOnly) {
      continue;
    }

    const { originalText, quantity, unit, productPhrase } = parsedSegment;

    // Case 1: Missing product (e.g. "2 packets" with no product named)
    if (!productPhrase && quantity) {
      const question = `Which product would you like ${quantity} ${unit || 'units'} of?`;
      clarificationQuestions.push(question);

      parsedItems.push({
        originalText,
        productId: null,
        productName: null,
        matchedCatalogName: null,
        quantity: String(quantity),
        unit: unit || null,
        unitPrice: null,
        lineTotal: null,
        status: 'MISSING_PRODUCT',
        confidence: 0,
        clarificationReason: 'Product name was not identified in the order segment.',
      });
      continue;
    }

    // Case 2: Product phrase identified -> match against catalogue
    const matchResult = matchProductInCatalogue(productPhrase, catalogueProducts);

    if (matchResult.status === 'MATCHED') {
      const product = matchResult.product;
      const unitPriceStr = formatCurrency(product.price);
      const resolvedUnit = unit || matchResult.defaultUnit || product.unit;

      // Check if quantity is missing for this matched product
      if (!quantity) {
        const question = `How much ${product.name} would you like? (e.g. 1 ${product.unit})`;
        clarificationQuestions.push(question);

        parsedItems.push({
          originalText,
          productId: product.id,
          productName: product.name,
          matchedCatalogName: product.name,
          quantity: null,
          unit: resolvedUnit,
          catalogUnit: product.unit,
          unitPrice: unitPriceStr,
          lineTotal: null,
          status: 'MISSING_QUANTITY',
          confidence: matchResult.confidence,
          clarificationReason: `Quantity for '${product.name}' was not specified.`,
        });
      } else {
        // Confident match with quantity -> perform unit conversion & pricing audit
        const conversion = calculateUnitConversion({
          requestedQuantity: quantity,
          requestedUnit: unit,
          catalogUnit: product.unit,
          catalogPrice: product.price,
          productName: product.name,
        });

        if (conversion.status === 'MATCHED') {
          parsedItems.push({
            originalText,
            productId: product.id,
            productName: product.name,
            matchedCatalogName: product.name,
            quantity: String(quantity),
            unit: conversion.resolvedUnit,
            catalogUnit: product.unit,
            unitPrice: unitPriceStr,
            lineTotal: conversion.lineTotal,
            status: 'MATCHED',
            confidence: matchResult.confidence,
            ...(conversion.conversionNote && { conversionNote: conversion.conversionNote }),
          });
        } else {
          // Unsupported or incompatible unit conversion (e.g. 1 kg maggi, 1 litre sugar)
          clarificationQuestions.push(conversion.clarificationQuestion);

          parsedItems.push({
            originalText,
            productId: product.id,
            productName: product.name,
            matchedCatalogName: product.name,
            quantity: String(quantity),
            unit: unit || product.unit,
            catalogUnit: product.unit,
            unitPrice: unitPriceStr,
            lineTotal: null,
            status: 'UNSUPPORTED_UNIT',
            confidence: matchResult.confidence,
            clarificationReason: conversion.clarificationReason,
          });
        }
      }
    } else if (matchResult.status === 'AMBIGUOUS') {
      const candidateNames = matchResult.candidates.map(c => c.name).join(' or ');
      const question = `Did you mean ${candidateNames}?`;
      clarificationQuestions.push(question);

      parsedItems.push({
        originalText,
        productId: null,
        productName: productPhrase,
        matchedCatalogName: null,
        quantity: quantity ? String(quantity) : null,
        unit: unit || null,
        unitPrice: null,
        lineTotal: null,
        status: 'AMBIGUOUS',
        confidence: matchResult.confidence,
        candidates: matchResult.candidates.map(c => ({ id: c.id, name: c.name, unit: c.unit, price: formatCurrency(c.price) })),
        clarificationReason: `Multiple catalogue products match '${productPhrase}'.`,
      });
    } else {
      // UNMATCHED product
      const question = `'${productPhrase}' is currently not in our product catalogue. Would you like to order something else?`;
      clarificationQuestions.push(question);

      parsedItems.push({
        originalText,
        productId: null,
        productName: productPhrase,
        matchedCatalogName: null,
        quantity: quantity ? String(quantity) : null,
        unit: unit || null,
        unitPrice: null,
        lineTotal: null,
        status: 'UNMATCHED',
        confidence: matchResult.confidence,
        clarificationReason: `'${productPhrase}' could not be found in the store catalogue.`,
      });
    }
  }

  // Calculate draft order subtotal using only valid MATCHED items with line totals
  const matchedLineTotals = parsedItems
    .filter(item => item.status === 'MATCHED' && item.lineTotal)
    .map(item => item.lineTotal);

  const subtotal = sumDecimals(matchedLineTotals);
  const needsClarification = parsedItems.length === 0 || parsedItems.some(item => item.status !== 'MATCHED');

  // If transcript contained no valid order items (e.g. only greeting like "bhaiya ji")
  if (parsedItems.length === 0 && candidateSegments.length > 0) {
    clarificationQuestions.push('Could you please tell me what items you would like to order?');
  }

  return {
    transcript: rawTranscript,
    storeId: targetStoreId,
    items: parsedItems,
    unresolvedItems: parsedItems.filter((item) => item.status !== 'MATCHED'),
    subtotal,
    needsClarification,
    clarificationQuestions,
  };
};

export default {
  parseOrderTranscript,
};
