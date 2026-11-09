import axios from 'axios';
import { API_BASE_URL } from '../utils/constants.js';

// Create configured Axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Fetch backend health status from GET /api/health
 */
export const checkBackendHealth = async () => {
  const response = await apiClient.get('/health');
  return response.data;
};

/**
 * Fetch database connectivity status from GET /api/health/db
 */
export const checkDatabaseHealth = async () => {
  const response = await apiClient.get('/health/db');
  return response.data;
};

/**
 * Send audio recording for Gnani Prisma STT transcription and draft order parsing
 * POST /api/speech/transcribe
 * @param {Blob} audioBlob - Binary audio blob from browser MediaRecorder
 * @param {string} filename - Filename (e.g. 'recording.wav')
 * @param {string} [languageCode] - Optional language code override
 * @param {string} [storeId] - Optional store UUID to scope catalogue matching
 */
export const transcribeVoiceOrder = async (
  audioBlob,
  filename = 'recording.wav',
  languageCode = 'indic-auto',
  storeId = null
) => {
  const formData = new FormData();
  formData.append('audio_file', audioBlob, filename);
  if (languageCode) {
    formData.append('language_code', languageCode);
  }
  if (storeId) {
    formData.append('store_id', storeId);
    formData.append('storeId', storeId);
  }

  const response = await apiClient.post('/speech/transcribe', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * Parse text transcript into a structured draft order
 * POST /api/orders/parse
 * @param {string} transcript - Text transcript
 * @param {string} [storeId] - Store UUID
 */
export const parseOrderTranscript = async (transcript, storeId = null) => {
  const payload = { transcript };
  if (storeId) {
    payload.storeId = storeId;
    payload.store_id = storeId;
  }
  const response = await apiClient.post('/orders/parse', payload);
  return response.data;
};

/**
 * Calculate and verify order items and pricing against a store's live catalogue
 * POST /api/orders/calculate
 * @param {object} params - { storeId, items }
 */
export const calculateOrderPricing = async ({ storeId, items }) => {
  const response = await apiClient.post('/orders/calculate', { storeId, items });
  return response.data;
};

/**
 * Submit a customer order for in-store pickup
 * POST /api/orders
 * @param {object} orderData - { storeId, customerName, customerPhone, notes, items, idempotencyKey, confirmationToken }
 */
export const submitCustomerOrder = async (orderData) => {
  const headers = {};
  if (orderData.idempotencyKey) {
    headers['Idempotency-Key'] = orderData.idempotencyKey;
  }
  if (orderData.confirmationToken) {
    headers['X-Confirmation-Token'] = orderData.confirmationToken;
  }
  const response = await apiClient.post('/orders', orderData, { headers });
  return response.data;
};

/**
 * Retrieve public order details for confirmation page
 * GET /api/orders/:id
 * Securely transmits customer confirmation access token via header (never query string).
 * @param {string} orderId
 * @param {string} [token] - Optional confirmation access token
 */
export const fetchOrderById = async (orderId, token = null) => {
  const headers = {};
  if (token && typeof token === 'string' && token.trim().length > 0) {
    headers['X-Confirmation-Token'] = token.trim();
  }
  const response = await apiClient.get(`/orders/${orderId}`, { headers });
  return response.data;
};

// ============================================================================
// Merchant Authentication API
// ============================================================================

/**
 * Register a new Kirana store merchant
 * POST /api/auth/register
 */
export const registerMerchant = async (data) => {
  const response = await apiClient.post('/auth/register', data);
  return response.data;
};

/**
 * Login Kirana store merchant
 * POST /api/auth/login
 */
export const loginMerchant = async (credentials) => {
  const response = await apiClient.post('/auth/login', credentials);
  return response.data;
};

/**
 * Logout Kirana store merchant and terminate session
 * POST /api/auth/logout
 */
export const logoutMerchant = async () => {
  const response = await apiClient.post('/auth/logout');
  return response.data;
};

/**
 * Get current authenticated merchant store profile
 * GET /api/auth/me
 */
export const getMerchantProfile = async () => {
  const response = await apiClient.get('/auth/me');
  return response.data;
};

// ============================================================================
// Store-Scoped Product Catalogue API (Phase C1 & C2)
// ============================================================================

/**
 * Fetch products for authenticated store with optional filters and pagination
 * GET /api/products
 * @param {object} params - { search, category, isAvailable, page, limit }
 */
export const fetchProducts = async (params = {}) => {
  const response = await apiClient.get('/products', { params });
  return response.data;
};

/**
 * Fetch single product details by ID
 * GET /api/products/:id
 */
export const fetchProductById = async (id) => {
  const response = await apiClient.get(`/products/${id}`);
  return response.data;
};

/**
 * Create a new product for the authenticated store
 * POST /api/products
 */
export const createProduct = async (productData) => {
  const response = await apiClient.post('/products', productData);
  return response.data;
};

/**
 * Update an existing product for the authenticated store
 * PATCH /api/products/:id
 */
export const updateProduct = async (id, updateData) => {
  const response = await apiClient.patch(`/products/${id}`, updateData);
  return response.data;
};

/**
 * Soft-delete a product for the authenticated store (isActive: false)
 * DELETE /api/products/:id
 */
export const deleteProduct = async (id) => {
  const response = await apiClient.delete(`/products/${id}`);
  return response.data;
};

// ============================================================================
// Bulk Catalogue Import API (CSV / XLSX)
// ============================================================================

/**
 * Download sample CSV import template
 * GET /api/products/import/template
 */
export const downloadImportTemplate = async () => {
  const response = await apiClient.get('/products/import/template', {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'callsaar_product_import_template.csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

/**
 * Upload CSV or Excel (.xlsx) file to generate non-persisting validation preview
 * POST /api/products/import/preview
 * @param {File} file
 */
export const previewProductImport = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post('/products/import/preview', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * Atomically confirm and commit previewed products inside transaction
 * POST /api/products/import/confirm
 * @param {object} params - { importToken, duplicatePolicy: 'skip' | 'update' }
 */
export const confirmProductImport = async ({ importToken, duplicatePolicy = 'skip' }) => {
  const response = await apiClient.post('/products/import/confirm', {
    importToken,
    duplicatePolicy,
  });
  return response.data;
};

// ============================================================================
// Public Customer Store Discovery & Catalogue API (Phase D)
// ============================================================================

/**
 * Discover public stores with search, city/pincode filtering, and pagination
 * GET /api/stores
 * @param {object} params - { search, city, pincode, isOpen, page, limit }
 */
export const fetchPublicStores = async (params = {}) => {
  const response = await apiClient.get('/stores', { params });
  return response.data;
};

/**
 * Retrieve public details for a single store
 * GET /api/stores/:storeId
 * @param {string} storeId
 */
export const fetchPublicStoreById = async (storeId) => {
  const response = await apiClient.get(`/stores/${storeId}`);
  return response.data;
};

/**
 * Retrieve public available catalogue strictly for a single store
 * GET /api/stores/:storeId/catalogue
 * @param {string} storeId
 * @param {object} params - { search, category, page, limit }
 */
export const fetchPublicStoreCatalogue = async (storeId, params = {}) => {
  const response = await apiClient.get(`/stores/${storeId}/catalogue`, { params });
  return response.data;
};

// ============================================================================
// Merchant Order Management API (Phase F)
// ============================================================================

/**
 * List orders for the authenticated store with optional status, search, and pagination
 * GET /api/merchant/orders
 * @param {object} params - { status, search, page, limit }
 */
export const fetchMerchantOrders = async (params = {}) => {
  const response = await apiClient.get('/merchant/orders', { params });
  return response.data;
};

/**
 * Retrieve order count summary breakdown by status
 * GET /api/merchant/orders/summary
 */
export const fetchMerchantOrderSummary = async () => {
  const response = await apiClient.get('/merchant/orders/summary');
  return response.data;
};

/**
 * Retrieve full order details for the authenticated merchant
 * GET /api/merchant/orders/:orderId
 * @param {string} orderId
 */
export const fetchMerchantOrderById = async (orderId) => {
  const response = await apiClient.get(`/merchant/orders/${orderId}`);
  return response.data;
};

/**
 * Accept a pending order
 * PATCH /api/merchant/orders/:orderId/accept
 * @param {string} orderId
 */
export const acceptMerchantOrder = async (orderId) => {
  const response = await apiClient.patch(`/merchant/orders/${orderId}/accept`);
  return response.data;
};

/**
 * Reject a pending order with a reason
 * PATCH /api/merchant/orders/:orderId/reject
 * @param {string} orderId
 * @param {string} rejectionReason
 */
export const rejectMerchantOrder = async (orderId, rejectionReason) => {
  const response = await apiClient.patch(`/merchant/orders/${orderId}/reject`, {
    rejectionReason,
  });
  return response.data;
};

/**
 * Start preparing an accepted order
 * PATCH /api/merchant/orders/:orderId/prepare
 * @param {string} orderId
 */
export const prepareMerchantOrder = async (orderId) => {
  const response = await apiClient.patch(`/merchant/orders/${orderId}/prepare`);
  return response.data;
};

/**
 * Mark order packed and ready for pickup
 * PATCH /api/merchant/orders/:orderId/ready
 * @param {string} orderId
 */
export const markMerchantOrderReady = async (orderId) => {
  const response = await apiClient.patch(`/merchant/orders/${orderId}/ready`);
  return response.data;
};

/**
 * Record in-store payment
 * PATCH /api/merchant/orders/:orderId/payment
 * @param {string} orderId
 * @param {string} paymentMethod - 'CASH_ON_PICKUP' | 'UPI_AT_STORE'
 */
export const recordMerchantOrderPayment = async (orderId, paymentMethod) => {
  const response = await apiClient.patch(`/merchant/orders/${orderId}/payment`, {
    paymentMethod,
  });
  return response.data;
};

/**
 * Complete order after collection and confirmed payment
 * PATCH /api/merchant/orders/:orderId/complete
 * @param {string} orderId
 * @param {string} [paymentMethod]
 */
export const completeMerchantOrder = async (orderId, paymentMethod = null) => {
  const payload = paymentMethod ? { paymentMethod } : {};
  const response = await apiClient.patch(`/merchant/orders/${orderId}/complete`, payload);
  return response.data;
};

/**
 * Retrieve printable packing slip for an accepted order
 * GET /api/merchant/orders/:orderId/packing-slip
 * @param {string} orderId
 */
export const fetchPackingSlip = async (orderId) => {
  const response = await apiClient.get(`/merchant/orders/${orderId}/packing-slip`);
  return response.data;
};

export default apiClient;
