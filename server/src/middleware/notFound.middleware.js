/**
 * Catch-all middleware for routes that are not found (404)
 */
export const notFoundHandler = (req, res, next) => {
  const error = new Error(`Resource not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
};

