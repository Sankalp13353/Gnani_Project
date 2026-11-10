import { useState, useEffect, useCallback } from 'react';
import { checkBackendHealth, checkDatabaseHealth } from '../services/api.js';
import { CONNECTION_STATUS } from '../utils/constants.js';

export const useHealthCheck = () => {
  const [status, setStatus] = useState(CONNECTION_STATUS.CHECKING);
  const [data, setData] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const performHealthCheck = useCallback(async () => {
    setStatus(CONNECTION_STATUS.CHECKING);
    setError(null);

    try {
      const response = await checkBackendHealth();
      setData(response);
      setStatus(CONNECTION_STATUS.CONNECTED);

      // Probe database status
      try {
        const dbResponse = await checkDatabaseHealth();
        setDbStatus(dbResponse.database);
      } catch {
        setDbStatus('disconnected');
      }
    } catch (err) {
      console.error('Health check failed:', err);
      setError(err.message || 'Unable to connect to OrderSaathi API server');
      setStatus(CONNECTION_STATUS.DISCONNECTED);
      setDbStatus('disconnected');
    } finally {
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    performHealthCheck();
  }, [performHealthCheck]);

  return {
    status,
    data,
    dbStatus,
    error,
    lastChecked,
    refresh: performHealthCheck,
    isConnected: status === CONNECTION_STATUS.CONNECTED,
    isChecking: status === CONNECTION_STATUS.CHECKING,
  };
};
