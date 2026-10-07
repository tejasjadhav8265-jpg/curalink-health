const path = require('path');
const ApiError = require('../utils/apiError');
const { isProd } = require('../config/env');

// 404 for unknown /api routes.
function apiNotFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// Central error handler: maps library errors to friendly JSON and never leaks stack traces in production.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Something went wrong.';
  let details = err.details || null;

  if (err.name === 'ValidationError' && err.errors) { // Mongoose validation
    status = 400;
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = details[0].message;
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid identifier supplied.';
  } else if (err.code === 11000) { // Duplicate key (unique index)
    status = 409;
    const field = Object.keys(err.keyPattern || {})[0] || 'value';
    message = `That ${field} is already in use.`;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Your session has expired. Please log in again.';
  } else if (err.name === 'MulterError') {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large.' : 'File upload failed.';
  }

  if (status >= 500) {
    console.error(err); // full detail goes to server logs only
    if (isProd || !err.isOperational) message = 'Something went wrong on our side. Please try again.';
  }

  // A person opening a normal page (not the API) gets the friendly error page instead of JSON.
  if (!String(req.originalUrl).startsWith('/api') && status >= 500 && req.accepts(['html', 'json']) === 'html') {
    const page = path.join(__dirname, '..', '..', 'frontend', 'pages', 'errors', '500.html');
    return res.status(status).sendFile(page, (sendErr) => { if (sendErr) res.type('text').send('Something went wrong on our side.'); });
  }

  const body = { success: false, message };
  if (details) body.errors = details;
  if (!isProd && status >= 500) body.stack = err.stack;
  res.status(status).json(body);
}

module.exports = { apiNotFound, errorHandler };
