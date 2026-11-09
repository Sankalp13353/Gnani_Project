import {
  listStoreProducts,
  getStoreProductById,
  createStoreProduct,
  updateStoreProduct,
  softDeleteStoreProduct,
} from '../services/product.service.js';
import {
  isValidUuid,
  validateAndFormatPrice,
  parseAvailability,
} from '../utils/productValidation.js';

/**
 * GET /api/products
 * Lists catalogue products strictly for the authenticated store
 */
export const getProducts = async (req, res, next) => {
  try {
    const { search, category, isAvailable, page, limit } = req.query;

    let parsedIsAvailable;
    if (isAvailable !== undefined) {
      parsedIsAvailable = parseAvailability(isAvailable, false);
    }

    const result = await listStoreProducts({
      storeId: req.storeId,
      search,
      category,
      isAvailable: parsedIsAvailable,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
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

/**
 * GET /api/products/:id
 * Fetches single product strictly for the authenticated store
 */
export const getProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format. Must be a valid UUID.',
      });
    }

    const product = await getStoreProductById({
      id,
      storeId: req.storeId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/products
 * Creates a new product for the authenticated store
 */
export const createProduct = async (req, res, next) => {
  try {
    const body = req.body || {};

    // Security & Validation: Prevent client override of storeId
    if (body.storeId && body.storeId !== req.storeId) {
      return res.status(400).json({
        success: false,
        message: 'Cross-store product creation is not permitted. storeId is derived automatically.',
      });
    }

    // Security: Disallow unexpected system fields
    if ('passwordHash' in body) {
      return res.status(400).json({
        success: false,
        message: 'Invalid field: passwordHash is not allowed',
      });
    }

    if ('id' in body) {
      return res.status(400).json({
        success: false,
        message: 'Invalid field: id cannot be specified on creation',
      });
    }

    const { name, description, category, brand, unit, price, isAvailable } = body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product name is required and cannot be empty',
      });
    }

    // Validate unit
    if (!unit || typeof unit !== 'string' || unit.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product unit is required and cannot be empty',
      });
    }

    // Validate and format monetary price
    const formattedPrice = validateAndFormatPrice(price, true);

    // Validate availability
    const available = isAvailable !== undefined ? parseAvailability(isAvailable, true) : true;

    const product = await createStoreProduct({
      storeId: req.storeId,
      name,
      description,
      category,
      brand,
      unit,
      price: formattedPrice,
      isAvailable: available,
    });

    return res.status(201).json({
      success: true,
      data: product,
      message: 'Product created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/products/:id
 * Updates an existing product for the authenticated store
 */
export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format. Must be a valid UUID.',
      });
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No update fields provided',
      });
    }

    // Security: Prevent modifying store ownership, id, timestamps, or secrets
    if ('storeId' in body || 'store_id' in body) {
      return res.status(400).json({
        success: false,
        message: 'Modifying storeId is not permitted',
      });
    }

    if ('id' in body) {
      return res.status(400).json({
        success: false,
        message: 'Modifying product id is not permitted',
      });
    }

    if ('createdAt' in body || 'updatedAt' in body) {
      return res.status(400).json({
        success: false,
        message: 'Modifying timestamps is not permitted',
      });
    }

    if ('passwordHash' in body) {
      return res.status(400).json({
        success: false,
        message: 'Invalid field: passwordHash is not allowed',
      });
    }

    const allowedFields = ['name', 'description', 'category', 'brand', 'unit', 'price', 'isAvailable'];
    const hasAllowedField = allowedFields.some((f) => f in body);
    if (!hasAllowedField) {
      return res.status(400).json({
        success: false,
        message: 'At least one valid field must be provided for update',
      });
    }

    const updateData = {};

    if ('name' in body) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Product name cannot be empty',
        });
      }
      updateData.name = body.name.trim();
    }

    if ('unit' in body) {
      if (typeof body.unit !== 'string' || body.unit.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Product unit cannot be empty',
        });
      }
      updateData.unit = body.unit.trim();
    }

    if ('description' in body) {
      updateData.description = body.description ? String(body.description).trim() : null;
    }

    if ('category' in body) {
      updateData.category = body.category ? String(body.category).trim() : null;
    }

    if ('brand' in body) {
      updateData.brand = body.brand ? String(body.brand).trim() : null;
    }

    if ('price' in body) {
      updateData.price = validateAndFormatPrice(body.price, true);
    }

    if ('isAvailable' in body) {
      updateData.isAvailable = parseAvailability(body.isAvailable, true);
    }

    const updatedProduct = await updateStoreProduct({
      id,
      storeId: req.storeId,
      updateData,
    });

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: updatedProduct,
      message: 'Product updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/products/:id
 * Soft-deletes a product for the authenticated store (isActive: false)
 */
export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format. Must be a valid UUID.',
      });
    }

    const deleted = await softDeleteStoreProduct({
      id,
      storeId: req.storeId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
