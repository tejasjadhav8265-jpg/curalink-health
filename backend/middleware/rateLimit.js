const rateLimit = require('express-rate-limit');
const { isProd } = require('../config/env');

const json429 = (message) => (req, res) =>
  res.status(429).json({ success: false, message });

// General API limiter.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429('Too many requests. Please try again in a few minutes.'),
});

// Strict limiter for login/register to slow brute-force attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 20 : 100, // relaxed in development so testing isn't blocked
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429('Too many attempts. Please try again in 15 minutes.'),
});

// Public forms (contact, ambulance request) - stops someone filling the inbox with junk.
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 8 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429('You have sent several requests in a short time. Please wait a few minutes and try again.'),
});

module.exports = { apiLimiter, authLimiter, formLimiter };
