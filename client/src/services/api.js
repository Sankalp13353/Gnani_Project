import axios from 'axios';
import { API_BASE_URL } from '../utils/constants.js';

// Create configured Axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
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
 * @param {string} filename - Filename (e.g. 'recording.webm')
 * @param {string} [languageCode] - Optional language code override
 */
export const transcribeVoiceOrder = async (audioBlob, filename = 'recording.webm', languageCode = 'indic-auto') => {
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

/**
 * Fetch active products from the store catalogue
 * GET /api/products
 */
export const fetchProducts = async () => {
  const response = await apiClient.get('/products');
  return response.data;
};

export default apiClient;


