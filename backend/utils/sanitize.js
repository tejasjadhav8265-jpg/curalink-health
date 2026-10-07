const xss = require('xss');

// Fields that must never be altered by HTML escaping.
const SKIP_KEYS = new Set(['password', 'confirmPassword', 'currentPassword', 'newPassword']);

function clean(value, key) {
  if (typeof value === 'string') return SKIP_KEYS.has(key) ? value : xss(value.trim());
  if (Array.isArray(value)) return value.map((v) => clean(v, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v, k)]));
  }
  return value;
}

// Express middleware: strips dangerous HTML/script from every string in req.body.
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') req.body = clean(req.body);
  next();
}

module.exports = { sanitizeBody, clean };
