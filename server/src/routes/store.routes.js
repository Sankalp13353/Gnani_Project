import { Router } from 'express';
import {
  getStores,
  getStore,
  getStoreCatalogue,
} from '../controllers/store.controller.js';

const router = Router();

// Public Customer-Facing Store Discovery and Catalogue Endpoints
// (No store owner authentication required)

// GET /api/stores - Discover public local stores with search & location filters
router.get('/', getStores);

// GET /api/stores/:storeId - Retrieve public details for a single store
router.get('/:storeId', getStore);

// GET /api/stores/:storeId/catalogue - Retrieve public available catalogue for a single store
router.get('/:storeId/catalogue', getStoreCatalogue);

export default router;

