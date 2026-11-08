import { listActiveProducts, getProductById } from '../services/product.service.js';

/**
 * Controller to list active catalogue products
 * GET /api/products
 */
export const getProducts = async (req, res, next) => {
  try {
    const { storeId, store_id, category, search, limit, offset } = req.query;
    const products = await listActiveProducts({
      storeId: storeId || store_id,
      category,
      search,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to get product by ID
 * GET /api/products/:id
 */
export const getProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await getProductById(id);

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

