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
 */
export const transcribeVoiceOrder = async (audioBlob, filename = 'recording.wav', languageCode = 'indic-auto') => {
  const formData = new FormData();
  formData.append('audio_file', audioBlob, filename);
  if (languageCode) {
    formData.append('language_code', languageCode);
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
 */
export const parseOrderTranscript = async (transcript) => {
  const response = await apiClient.post('/orders/parse', { transcript });
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

export default apiClient;
