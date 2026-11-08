import axios from 'axios';
import { API_BASE_URL } from '../utils/constants.js';

// Create configured Axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
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

export default apiClient;

