import {
  listPublicStores,
  getPublicStoreById,
  getPublicStoreCatalogue,
} from '../services/store.service.js';
import { isValidUuid } from '../utils/productValidation.js';

/**
 * GET /api/stores
 * Public store discovery with optional name search, city/pincode filtering, and pagination
 */
export const getStores = async (req, res, next) => {
  try {
    const { search, city, pincode, isOpen, page, limit } = req.query;

    const result = await listPublicStores({
      search,
      city,
      pincode,
      isOpen,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      count: result.stores.length,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      data: result.stores,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/stores/:storeId
 * Public details for one store
 */
export const getStore = async (req, res, next) => {
  try {
    const { storeId } = req.params;

    if (!isValidUuid(storeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid store ID format. Must be a valid UUID.',
      });
    }

    const store = await getPublicStoreById(storeId);

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: store,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/stores/:storeId/catalogue
 * Public store catalogue products strictly scoped to requested store
 */
export const getStoreCatalogue = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { search, category, page, limit } = req.query;

    if (!isValidUuid(storeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid store ID format. Must be a valid UUID.',
      });
    }

    const result = await getPublicStoreCatalogue({
      storeId,
      search,
      category,
      page,
      limit,
    });

    if (result.storeNotFound) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    return res.status(200).json({
      success: true,
      store: result.store,
      count: result.products.length,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      data: result.products,
    });
  } catch (error) {
    next(error);
  }
};

