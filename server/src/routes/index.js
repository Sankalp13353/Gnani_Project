import { Router } from 'express';
import healthRoutes from './health.routes.js';
import productRoutes from './product.routes.js';
import orderRoutes from './order.routes.js';
import speechRoutes from './speech.routes.js';

const router = Router();

// Mount feature routes
router.use('/', healthRoutes);
router.use('/', productRoutes);
router.use('/', orderRoutes);
router.use('/', speechRoutes);

export default router;
