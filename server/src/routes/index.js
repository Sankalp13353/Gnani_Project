import { Router } from 'express';
import healthRoutes from './health.routes.js';
import productRoutes from './product.routes.js';
import orderRoutes from './order.routes.js';
import speechRoutes from './speech.routes.js';
import authRoutes from './auth.routes.js';
import storeRoutes from './store.routes.js';
import merchantOrderRoutes from './merchantOrder.routes.js';

const router = Router();

// Mount feature routes
router.use('/', healthRoutes);
router.use('/', productRoutes);
router.use('/', orderRoutes);
router.use('/', speechRoutes);
router.use('/auth', authRoutes);
router.use('/stores', storeRoutes);
router.use('/merchant/orders', merchantOrderRoutes);

export default router;
