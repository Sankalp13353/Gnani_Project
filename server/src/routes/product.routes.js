import { Router } from 'express';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller.js';
import {
  downloadTemplate,
  previewImport,
  confirmImport,
} from '../controllers/import.controller.js';
import { authenticateMerchant } from '../middleware/auth.middleware.js';
import { handleImportFileUpload } from '../middleware/fileUpload.middleware.js';

const router = Router();

// Protect all merchant store-scoped catalogue endpoints with merchant authentication
router.use('/products', authenticateMerchant);

// --- Bulk Import Endpoints (Placed before /products/:id to prevent route shadowing) ---
// GET /api/products/import/template - Download safe sample CSV template
router.get('/products/import/template', downloadTemplate);

// POST /api/products/import/preview - Non-persisting validation preview for CSV/XLSX
router.post('/products/import/preview', handleImportFileUpload, previewImport);

// POST /api/products/import/confirm - Atomic transactional commit of validated import items
router.post('/products/import/confirm', confirmImport);

// --- Standard Product CRUD Endpoints ---
// GET /api/products - List products strictly for authenticated store
router.get('/products', getProducts);

// GET /api/products/:id - Fetch single product for authenticated store
router.get('/products/:id', getProduct);

// POST /api/products - Create product for authenticated store
router.post('/products', createProduct);

// PATCH /api/products/:id - Update product for authenticated store
router.patch('/products/:id', updateProduct);

// DELETE /api/products/:id - Soft-delete product for authenticated store
router.delete('/products/:id', deleteProduct);

export default router;
