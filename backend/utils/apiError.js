// Operational errors: safe to show their message to the client.
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
  static badRequest(msg = 'Bad request', details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'Please log in to continue.') { return new ApiError(401, msg); }
  static forbidden(msg = 'You do not have permission to do this.') { return new ApiError(403, msg); }
  static notFound(msg = 'Resource not found.') { return new ApiError(404, msg); }
  static conflict(msg = 'Conflict.') { return new ApiError(409, msg); }
}
module.exports = ApiError;
