import {
  generateSampleCsvTemplate,
  previewProductImport,
  confirmProductImport,
} from '../services/import.service.js';

/**
 * GET /api/products/import/template
 * Downloads safe sample CSV template for product imports
 */
export const downloadTemplate = (req, res) => {
  const csvContent = generateSampleCsvTemplate();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="ordersaathi_product_import_template.csv"');
  return res.status(200).send(csvContent);
};

/**
 * POST /api/products/import/preview
 * Parses and validates uploaded CSV/XLSX file without persisting to database
 */
export const previewImport = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a CSV or Excel (.xlsx) file to import.',
      });
    }

    const preview = await previewProductImport({
      storeId: req.storeId,
      fileBuffer: req.file.buffer,
      filename: req.file.originalname,
    });

    return res.status(200).json({
      success: true,
      data: preview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/products/import/confirm
 * Atomically commits validated preview items to store catalogue
 */
export const confirmImport = async (req, res, next) => {
  try {
    const { importToken, duplicatePolicy } = req.body || {};

    if (!importToken) {
      return res.status(400).json({
        success: false,
        message: 'importToken is required to confirm bulk product import.',
      });
    }

    const result = await confirmProductImport({
      storeId: req.storeId,
      importToken,
      duplicatePolicy,
    });

    return res.status(200).json({
      success: true,
      message: 'Bulk import completed successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

