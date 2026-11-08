import { Router } from 'express';
import { getProducts, getProduct } from '../controllers/product.controller.js';

const router = Router();

// GET /api/products
router.get('/products', getProducts);

// GET /api/products/:id
router.get('/products/:id', getProduct);

export default router;

