/**
 * Unit Converter & Pricing Utility
 * Safely calculates order item quantities, conversion factors, and line totals
 * when customer requested units differ from catalogue selling units.
 */

import { multiplyDecimals, formatCurrency } from './decimal.js';

// Base dimension classifications
const DIMENSIONS = {
  WEIGHT: 'WEIGHT',
  VOLUME: 'VOLUME',
  COUNT: 'COUNT',
};

// Unit factors relative to base units (g for WEIGHT, ml for VOLUME, unit for COUNT)
const BASE_CONVERSIONS = {
  // Weight -> base: gram (g)
  kg: { dimension: DIMENSIONS.WEIGHT, multiplier: 1000, baseUnit: 'g' },
  kilo: { dimension: DIMENSIONS.WEIGHT, multiplier: 1000, baseUnit: 'g' },
  kilos: { dimension: DIMENSIONS.WEIGHT, multiplier: 1000, baseUnit: 'g' },
  kilogram: { dimension: DIMENSIONS.WEIGHT, multiplier: 1000, baseUnit: 'g' },
  kilograms: { dimension: DIMENSIONS.WEIGHT, multiplier: 1000, baseUnit: 'g' },
  g: { dimension: DIMENSIONS.WEIGHT, multiplier: 1, baseUnit: 'g' },
  gram: { dimension: DIMENSIONS.WEIGHT, multiplier: 1, baseUnit: 'g' },
  grams: { dimension: DIMENSIONS.WEIGHT, multiplier: 1, baseUnit: 'g' },
  gm: { dimension: DIMENSIONS.WEIGHT, multiplier: 1, baseUnit: 'g' },
  gms: { dimension: DIMENSIONS.WEIGHT, multiplier: 1, baseUnit: 'g' },

  // Volume -> base: millilitre (ml)
  litre: { dimension: DIMENSIONS.VOLUME, multiplier: 1000, baseUnit: 'ml' },
  liter: { dimension: DIMENSIONS.VOLUME, multiplier: 1000, baseUnit: 'ml' },
  litres: { dimension: DIMENSIONS.VOLUME, multiplier: 1000, baseUnit: 'ml' },
  liters: { dimension: DIMENSIONS.VOLUME, multiplier: 1000, baseUnit: 'ml' },
  l: { dimension: DIMENSIONS.VOLUME, multiplier: 1000, baseUnit: 'ml' },
  ltr: { dimension: DIMENSIONS.VOLUME, multiplier: 1000, baseUnit: 'ml' },
  ml: { dimension: DIMENSIONS.VOLUME, multiplier: 1, baseUnit: 'ml' },
  mls: { dimension: DIMENSIONS.VOLUME, multiplier: 1, baseUnit: 'ml' },
  millilitre: { dimension: DIMENSIONS.VOLUME, multiplier: 1, baseUnit: 'ml' },
  milliliter: { dimension: DIMENSIONS.VOLUME, multiplier: 1, baseUnit: 'ml' },

  // Discrete Packaging / Count -> base: unit
  packet: { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  packets: { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  pkt: { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  pkts: { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  pouch: { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  pouches: { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  pack: { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  packs: { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  piece: { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  pieces: { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  pc: { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  pcs: { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  box: { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  boxes: { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  bottle: { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  bottles: { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },

  // Devanagari Hindi units
  // Weight
  'किलो': { dimension: DIMENSIONS.WEIGHT, multiplier: 1000, baseUnit: 'g' },
  'किलोग्राम': { dimension: DIMENSIONS.WEIGHT, multiplier: 1000, baseUnit: 'g' },
  'किग्रा': { dimension: DIMENSIONS.WEIGHT, multiplier: 1000, baseUnit: 'g' },
  'केजी': { dimension: DIMENSIONS.WEIGHT, multiplier: 1000, baseUnit: 'g' },
  'केज़ी': { dimension: DIMENSIONS.WEIGHT, multiplier: 1000, baseUnit: 'g' },
  'ग्राम': { dimension: DIMENSIONS.WEIGHT, multiplier: 1, baseUnit: 'g' },
  'ग्रा': { dimension: DIMENSIONS.WEIGHT, multiplier: 1, baseUnit: 'g' },
  'जीएम': { dimension: DIMENSIONS.WEIGHT, multiplier: 1, baseUnit: 'g' },

  // Volume
  'लीटर': { dimension: DIMENSIONS.VOLUME, multiplier: 1000, baseUnit: 'ml' },
  'लिटर': { dimension: DIMENSIONS.VOLUME, multiplier: 1000, baseUnit: 'ml' },
  'ली': { dimension: DIMENSIONS.VOLUME, multiplier: 1000, baseUnit: 'ml' },
  'मिली': { dimension: DIMENSIONS.VOLUME, multiplier: 1, baseUnit: 'ml' },
  'मिलीलीटर': { dimension: DIMENSIONS.VOLUME, multiplier: 1, baseUnit: 'ml' },
  'एमएल': { dimension: DIMENSIONS.VOLUME, multiplier: 1, baseUnit: 'ml' },

  // Packaging
  'पैकेट': { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  'पैकेट्स': { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  'पैक': { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  'पाउच': { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  'पुड़िया': { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  'पीस': { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  'नग': { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  'डिब्बा': { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  'डब्बा': { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  'बॉक्स': { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
  'बोतल': { dimension: DIMENSIONS.COUNT, multiplier: 1, baseUnit: 'unit' },
};

/**
 * Parses any raw unit string into its dimension and base amount
 * Supports composite units such as "500ml", "100g", "1kg", "litre", "packet"
 * @param {string} unitStr
 * @returns {object|null}
 */
export const parseUnitDetails = (unitStr) => {
  if (!unitStr || typeof unitStr !== 'string') return null;

  const normalized = unitStr.toLowerCase().trim();

  // 1. Direct match in dictionary
  if (BASE_CONVERSIONS[normalized]) {
    const info = BASE_CONVERSIONS[normalized];
    return {
      raw: normalized,
      dimension: info.dimension,
      baseAmount: info.multiplier,
      baseUnit: info.baseUnit,
      isPackaged: false,
    };
  }

  // 2. Pattern with numeric prefix: e.g. "500ml", "100g", "1kg", "500मिली", "100ग्राम"
  const prefixMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*([\p{L}\p{M}]+)$/u);
  if (prefixMatch) {
    const [, numStr, unitPart] = prefixMatch;
    const info = BASE_CONVERSIONS[unitPart];
    if (info) {
      const num = parseFloat(numStr);
      return {
        raw: normalized,
        dimension: info.dimension,
        baseAmount: num * info.multiplier,
        baseUnit: info.baseUnit,
        isPackaged: true,
      };
    }
  }

  return null;
};

/**
 * Safely calculates conversion factor and line total between requested and catalogue units
 * @param {object} params
 * @param {string|number} params.requestedQuantity
 * @param {string|null} params.requestedUnit
 * @param {string} params.catalogUnit
 * @param {string|number|object} params.catalogPrice
 * @param {string} params.productName
 * @returns {object} Conversion calculation result
 */
export const calculateUnitConversion = ({
  requestedQuantity,
  requestedUnit,
  catalogUnit,
  catalogPrice,
  productName,
}) => {
  const priceFormatted = formatCurrency(catalogPrice);
  const qty = parseFloat(requestedQuantity);

  if (isNaN(qty) || qty <= 0) {
    return {
      isCompatible: false,
      status: 'MISSING_QUANTITY',
      factor: null,
      lineTotal: null,
      resolvedUnit: requestedUnit || catalogUnit,
    };
  }

  const catDetails = parseUnitDetails(catalogUnit);

  // If requestedUnit is missing, infer from catalogue packaging or default
  if (!requestedUnit) {
    const factorStr = String(qty);
    const lineTotal = multiplyDecimals(factorStr, priceFormatted);
    return {
      isCompatible: true,
      status: 'MATCHED',
      factor: factorStr,
      lineTotal,
      resolvedUnit: catalogUnit,
      conversionNote: null,
    };
  }

  const reqDetails = parseUnitDetails(requestedUnit);

  // If unit cannot be identified at all
  if (!reqDetails || !catDetails) {
    return {
      isCompatible: false,
      status: 'UNSUPPORTED_UNIT',
      factor: null,
      lineTotal: null,
      resolvedUnit: requestedUnit,
      clarificationReason: `Unit '${requestedUnit}' could not be recognized for '${productName}'.`,
      clarificationQuestion: `'${productName}' is sold per ${catalogUnit} (₹${priceFormatted}). Could you specify your order in ${catalogUnit}?`,
    };
  }

  // Case A: Identical or directly equivalent units (e.g. kg to kg, packet to packet)
  if (reqDetails.dimension === catDetails.dimension && reqDetails.baseAmount === catDetails.baseAmount) {
    const factorStr = String(qty);
    const lineTotal = multiplyDecimals(factorStr, priceFormatted);
    return {
      isCompatible: true,
      status: 'MATCHED',
      factor: factorStr,
      lineTotal,
      resolvedUnit: requestedUnit,
      conversionNote: null,
    };
  }

  // Case B: Same Dimension (WEIGHT <-> WEIGHT or VOLUME <-> VOLUME)
  if (reqDetails.dimension === catDetails.dimension) {
    const totalRequestedBase = qty * reqDetails.baseAmount;
    const catBase = catDetails.baseAmount;

    // Subcase B1: Catalogue is a fixed sealed pack (e.g. 500ml pouch milk, 100g butter)
    if (catDetails.isPackaged) {
      const packCount = totalRequestedBase / catBase;
      // Must be an exact integer number of packs (e.g. 1000ml = 2 pouches of 500ml)
      const roundedPacks = Math.round(packCount);
      const isExactInteger = Math.abs(packCount - roundedPacks) < 0.0001;

      if (!isExactInteger || roundedPacks <= 0) {
        return {
          isCompatible: false,
          status: 'UNSUPPORTED_UNIT',
          factor: null,
          lineTotal: null,
          resolvedUnit: requestedUnit,
          clarificationReason: `'${productName}' is sold in sealed ${catalogUnit} packs and cannot be divided into ${requestedQuantity} ${requestedUnit}.`,
          clarificationQuestion: `'${productName}' is available in ${catalogUnit} packs (₹${priceFormatted} per pack). Would you like ${Math.max(1, Math.floor(packCount))} or ${Math.ceil(packCount)} pack(s)?`,
        };
      }

      const factorStr = String(roundedPacks);
      const lineTotal = multiplyDecimals(factorStr, priceFormatted);
      return {
        isCompatible: true,
        status: 'MATCHED',
        factor: factorStr,
        lineTotal,
        resolvedUnit: requestedUnit,
        conversionNote: `${requestedQuantity} ${requestedUnit} = ${roundedPacks} ${catalogUnit} pack(s)`,
      };
    }

    // Subcase B2: Catalogue is loose/continuous measurement (e.g. Sugar: ₹45/kg, Oil: ₹150/litre)
    const factor = totalRequestedBase / catBase;
    const factorStr = String(factor);
    const lineTotal = multiplyDecimals(factorStr, priceFormatted);

    return {
      isCompatible: true,
      status: 'MATCHED',
      factor: factorStr,
      lineTotal,
      resolvedUnit: requestedUnit,
      conversionNote: `${requestedQuantity} ${requestedUnit} = ${factor} ${catalogUnit}`,
    };
  }

  // Case C: Customer requested COUNT (packet/pouch/pack) for a pre-packaged product (e.g. 500ml milk, 100g butter, 1kg salt)
  if (reqDetails.dimension === DIMENSIONS.COUNT && (catDetails.isPackaged || catDetails.dimension === DIMENSIONS.COUNT)) {
    const factorStr = String(qty);
    const lineTotal = multiplyDecimals(factorStr, priceFormatted);
    return {
      isCompatible: true,
      status: 'MATCHED',
      factor: factorStr,
      lineTotal,
      resolvedUnit: requestedUnit,
      conversionNote: `${qty} ${requestedUnit} @ ₹${priceFormatted} per ${catalogUnit}`,
    };
  }

  // Case D: Incompatible dimension mismatch (e.g. 1 kg Maggi, 1 litre Sugar, 1 kg Oil)
  const dimensionLabels = {
    [DIMENSIONS.WEIGHT]: 'weight (kg/g)',
    [DIMENSIONS.VOLUME]: 'volume (litre/ml)',
    [DIMENSIONS.COUNT]: 'packets/pieces',
  };

  const catLabel = dimensionLabels[catDetails.dimension] || catalogUnit;
  const reqLabel = dimensionLabels[reqDetails.dimension] || requestedUnit;

  return {
    isCompatible: false,
    status: 'UNSUPPORTED_UNIT',
    factor: null,
    lineTotal: null,
    resolvedUnit: requestedUnit,
    clarificationReason: `'${productName}' is sold by ${catLabel} and cannot be converted from ${reqLabel}.`,
    clarificationQuestion: `'${productName}' is sold by ${catLabel} in ${catalogUnit} (₹${priceFormatted} per ${catalogUnit}). How many ${catalogUnit} would you like?`,
  };
};

export default {
  parseUnitDetails,
  calculateUnitConversion,
};
