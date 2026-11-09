import crypto from 'node:crypto';
import * as XLSX from 'xlsx';
import prisma from '../config/prisma.js';
import {
  validateAndFormatPrice,
  parseAvailability,
  sanitizeCsvCell,
} from '../utils/productValidation.js';

/**
 * In-Memory Import Sessions Store
 * Maps importToken -> { storeId, validRows, summary, createdAt, expiresAt }
 * Session expires after 15 minutes.
 */
export const importSessions = new Map();
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const MAX_IMPORT_ROWS = 500;

// Periodic cleanup of expired import sessions
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of importSessions.entries()) {
    if (session.expiresAt <= now) {
      importSessions.delete(token);
    }
  }
}, 60 * 1000).unref();

/**
 * Generates sample CSV template safe from CSV / Formula injection
 * @returns {string}
 */
export const generateSampleCsvTemplate = () => {
  const headers = ['name', 'brand', 'category', 'description', 'unit', 'price', 'isAvailable'];
  const sampleRows = [
    ['Aashirvaad Shudh Chakki Atta', 'Aashirvaad', 'Flours', '100% whole wheat chakki atta', 'kg', '55.00', 'true'],
    ['Fortune Sunlite Sunflower Oil', 'Fortune', 'Oils', 'Refined sunflower edible oil', 'litre', '145.00', 'true'],
    ['Tata Salt Vacuum Evaporated', 'Tata', 'Spices & Seasoning', 'Iodised vacuum evaporated table salt', 'kg', '28.00', 'true'],
    ['Maggi 2-Minute Masala Noodles', 'Nestle', 'Instant Foods', 'Favorite instant noodles 70g packet', 'packet', '14.00', 'true'],
    ['Amul Taaza Homogenised Toned Milk', 'Amul', 'Dairy', 'Fresh pasteurized toned milk 500ml', 'packet', '27.00', 'true'],
    ['India Gate Basmati Rice Classic', 'India Gate', 'Grains & Rice', 'Premium aged long grain basmati rice', 'kg', '120.00', 'true'],
  ];

  const escapeCell = (cell) => {
    const sanitized = sanitizeCsvCell(cell);
    if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')) {
      return `"${sanitized.replace(/"/g, '""')}"`;
    }
    return sanitized;
  };

  const headerLine = headers.join(',');
  const rowLines = sampleRows.map((row) => row.map(escapeCell).join(','));
  return [headerLine, ...rowLines].join('\n') + '\n';
};

/**
 * Normalizes raw sheet column keys to standard product model attributes
 * @param {object} row
 * @returns {object}
 */
const normalizeRowKeys = (row) => {
  const normalized = {};
  for (const [key, val] of Object.entries(row)) {
    const cleanKey = String(key).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanKey === 'name' || cleanKey === 'productname' || cleanKey === 'product') {
      normalized.name = val;
    } else if (cleanKey === 'brand') {
      normalized.brand = val;
    } else if (cleanKey === 'category') {
      normalized.category = val;
    } else if (cleanKey === 'description' || cleanKey === 'desc') {
      normalized.description = val;
    } else if (cleanKey === 'unit') {
      normalized.unit = val;
    } else if (cleanKey === 'price' || cleanKey === 'rate' || cleanKey === 'priceinr' || cleanKey === 'mrp') {
      normalized.price = val;
    } else if (cleanKey === 'isavailable' || cleanKey === 'available' || cleanKey === 'availability') {
      normalized.isAvailable = val;
    }
  }
  return normalized;
};

/**
 * Parses uploaded CSV or XLSX file and generates a non-persisting validation preview
 *
 * @param {object} params
 * @param {string} params.storeId - Authenticated store ID
 * @param {Buffer} params.fileBuffer - Uploaded file buffer
 * @param {string} [params.filename] - Original file name
 * @returns {Promise<object>} Preview data with valid and invalid rows + secure import token
 */
export const previewProductImport = async ({ storeId, fileBuffer, filename = '' }) => {
  if (!fileBuffer || fileBuffer.length === 0) {
    const error = new Error('No file content provided for import');
    error.statusCode = 400;
    throw error;
  }

  // Parse workbook from buffer (supports both .csv and .xlsx)
  let workbook;
  try {
    workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  } catch (err) {
    const error = new Error(`Failed to parse file: ${err.message || 'Malformed CSV or Excel file'}`);
    error.statusCode = 400;
    throw error;
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    const error = new Error('File contains no worksheets');
    error.statusCode = 400;
    throw error;
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

  if (rawRows.length === 0) {
    const error = new Error('Uploaded file contains no data rows');
    error.statusCode = 400;
    throw error;
  }

  if (rawRows.length > MAX_IMPORT_ROWS) {
    const error = new Error(`File exceeds maximum allowed limit of ${MAX_IMPORT_ROWS} rows (found ${rawRows.length} rows)`);
    error.statusCode = 400;
    throw error;
  }

  // Validate that required column headers exist
  const sampleNormalized = normalizeRowKeys(rawRows[0]);
  const hasName = 'name' in sampleNormalized;
  const hasUnit = 'unit' in sampleNormalized;
  const hasPrice = 'price' in sampleNormalized;

  if (!hasName || !hasUnit || !hasPrice) {
    const missing = [];
    if (!hasName) missing.push('name');
    if (!hasUnit) missing.push('unit');
    if (!hasPrice) missing.push('price');
    const error = new Error(`Invalid file format: Missing required columns (${missing.join(', ')})`);
    error.statusCode = 400;
    throw error;
  }

  // Fetch existing active products in the store to detect duplicates
  const existingProducts = await prisma.product.findMany({
    where: {
      storeId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      unit: true,
      price: true,
    },
  });

  const existingMap = new Map();
  for (const p of existingProducts) {
    existingMap.set(p.name.trim().toLowerCase(), p);
  }

  const validRows = [];
  const invalidRows = [];
  const seenFileNames = new Set();
  let duplicateCount = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const rowNumber = i + 2; // Row 1 is header, data starts at Row 2
    const raw = rawRows[i];
    const normalized = normalizeRowKeys(raw);
    const errors = [];

    // 1. Validate Product Name
    let cleanName = '';
    if (!normalized.name || typeof normalized.name !== 'string' || normalized.name.trim().length === 0) {
      errors.push('Product name is required');
    } else {
      cleanName = normalized.name.trim();
    }

    // 2. Validate Unit
    let cleanUnit = '';
    if (!normalized.unit || typeof normalized.unit !== 'string' || normalized.unit.trim().length === 0) {
      errors.push('Product unit is required');
    } else {
      cleanUnit = normalized.unit.trim();
    }

    // 3. Validate Price
    let cleanPrice = '0.00';
    try {
      cleanPrice = validateAndFormatPrice(normalized.price, true);
    } catch (err) {
      errors.push(err.message || 'Invalid product price');
    }

    // 4. Validate Availability
    let cleanAvailability = true;
    try {
      cleanAvailability = parseAvailability(normalized.isAvailable, true);
    } catch (err) {
      errors.push(err.message || 'Invalid availability value');
    }

    // 5. In-file duplicate check
    const nameKey = cleanName.toLowerCase();
    if (cleanName && seenFileNames.has(nameKey)) {
      errors.push(`Duplicate product name in uploaded file ("${cleanName}")`);
    } else if (cleanName) {
      seenFileNames.add(nameKey);
    }

    if (errors.length > 0) {
      invalidRows.push({
        rowNumber,
        raw,
        errors,
      });
      continue;
    }

    // Check if product already exists in store
    const existing = existingMap.get(nameKey);
    const isDuplicate = Boolean(existing);
    if (isDuplicate) {
      duplicateCount++;
    }

    validRows.push({
      rowNumber,
      name: cleanName,
      brand: normalized.brand ? String(normalized.brand).trim() : null,
      category: normalized.category ? String(normalized.category).trim() : null,
      description: normalized.description ? String(normalized.description).trim() : null,
      unit: cleanUnit,
      price: cleanPrice,
      isAvailable: cleanAvailability,
      isDuplicate,
      existingProduct: existing
        ? {
            id: existing.id,
            price: existing.price.toString(),
            unit: existing.unit,
          }
        : null,
    });
  }

  // Generate secure, cryptographically random import reference token
  const importToken = crypto.randomUUID();
  const summary = {
    totalRows: rawRows.length,
    validCount: validRows.length,
    invalidCount: invalidRows.length,
    duplicateCount,
    filename: filename || 'catalogue_import',
  };

  // Cache preview data for confirmation (strictly bound to authenticated storeId)
  importSessions.set(importToken, {
    storeId,
    validRows,
    summary,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  });

  return {
    importToken,
    summary,
    validRows,
    invalidRows,
  };
};

/**
 * Confirms product import inside a database transaction
 *
 * @param {object} params
 * @param {string} params.storeId - Authenticated store ID
 * @param {string} params.importToken - Token returned by preview
 * @param {string} [params.duplicatePolicy='skip'] - 'skip' (default) or 'update'
 * @returns {Promise<object>} Import result counts
 */
export const confirmProductImport = async ({
  storeId,
  importToken,
  duplicatePolicy = 'skip',
}) => {
  if (!importToken || typeof importToken !== 'string') {
    const error = new Error('importToken is required to confirm bulk import');
    error.statusCode = 400;
    throw error;
  }

  const session = importSessions.get(importToken);
  if (!session || session.expiresAt <= Date.now()) {
    const error = new Error('Import session expired or invalid. Please upload the file again to preview and confirm.');
    error.statusCode = 400;
    throw error;
  }

  // Strict Tenant Isolation: Validate that the session belongs to the authenticated store
  if (session.storeId !== storeId) {
    const error = new Error('Access denied: Import session does not belong to your store.');
    error.statusCode = 403;
    throw error;
  }

  if (session.validRows.length === 0) {
    const error = new Error('No valid rows available to import in this session.');
    error.statusCode = 400;
    throw error;
  }

  const validPolicy = duplicatePolicy === 'update' ? 'update' : 'skip';

  // Perform atomic bulk import inside a database transaction
  const result = await prisma.$transaction(async (tx) => {
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    // Fetch existing products for store within transaction
    const existing = await tx.product.findMany({
      where: {
        storeId,
        isActive: true,
      },
    });

    const existingMap = new Map();
    for (const p of existing) {
      existingMap.set(p.name.trim().toLowerCase(), p);
    }

    for (const row of session.validRows) {
      const key = row.name.trim().toLowerCase();
      const existingProduct = existingMap.get(key);

      if (existingProduct) {
        if (validPolicy === 'update') {
          await tx.product.update({
            where: { id: existingProduct.id },
            data: {
              brand: row.brand || existingProduct.brand,
              category: row.category || existingProduct.category,
              description: row.description || existingProduct.description,
              unit: row.unit,
              price: row.price,
              isAvailable: row.isAvailable,
            },
          });
          updatedCount++;
        } else {
          // 'skip' preserves existing product untouched
          skippedCount++;
        }
      } else {
        await tx.product.create({
          data: {
            storeId,
            name: row.name,
            brand: row.brand,
            category: row.category,
            description: row.description,
            unit: row.unit,
            price: row.price,
            isAvailable: row.isAvailable,
            isActive: true,
          },
        });
        createdCount++;
      }
    }

    return {
      createdCount,
      updatedCount,
      skippedCount,
      totalProcessed: session.validRows.length,
      duplicatePolicy: validPolicy,
    };
  });

  // Consume token to prevent replay
  importSessions.delete(importToken);

  return result;
};

