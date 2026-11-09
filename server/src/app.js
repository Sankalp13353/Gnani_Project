import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/env.js';
import apiRoutes from './routes/index.js';
import { notFoundHandler } from './middleware/notFound.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();

// Middleware: Enable CORS
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      const allowedOrigins = [
        config.clientUrl,
        'http://localhost:5173',
        'http://127.0.0.1:5173'
      ];
      if (allowedOrigins.includes(origin) || config.isDev) {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy'));
    },
    credentials: true
  })
);

// Middleware: Parse Cookie headers
app.use(cookieParser());

// Middleware: Parse JSON bodies
app.use(express.json());

// Middleware: Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Mount API routes at /api
app.use('/api', apiRoutes);

// 404 Handler for undefined routes
app.use(notFoundHandler);

// Centralised error handling middleware
app.use(errorHandler);

export default app;

