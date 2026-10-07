const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { jwtSecret, jwtExpiresIn, isProd, cookieMaxAgeMs } = require('../config/env');

const COOKIE_NAME = 'token';

function signToken(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role, tv: user.tokenVersion || 0 }, jwtSecret, { expiresIn: jwtExpiresIn });
}

// httpOnly keeps the JWT out of reach of JavaScript (limits XSS token theft).
function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: cookieMaxAgeMs,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: isProd });
}

// Verifies the JWT, loads the user, attaches it as req.user.
const authenticateUser = asyncHandler(async (req, res, next) => {
  let token = req.cookies && req.cookies[COOKIE_NAME];
  const header = req.headers.authorization;
  if (!token && header && header.startsWith('Bearer ')) token = header.slice(7);
  if (!token) throw ApiError.unauthorized();

  const decoded = jwt.verify(token, jwtSecret); // JWT errors are mapped to 401 in error middleware
  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) throw ApiError.unauthorized('Your account is not active.');
  // Old tokens (before a password change) carry a smaller number and are refused.
  if ((decoded.tv || 0) !== (user.tokenVersion || 0)) throw ApiError.unauthorized('Your session has expired. Please log in again.');

  req.user = user;
  next();
});

// Like authenticateUser but never fails; used on public routes that personalise
// results when someone is logged in (e.g. storing search history with a userId).
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findById(decoded.id);
    if (user && user.isActive && (decoded.tv || 0) === (user.tokenVersion || 0)) req.user = user;
  } catch (_) { /* invalid token: treat as anonymous */ }
  next();
});

module.exports = { signToken, setAuthCookie, clearAuthCookie, authenticateUser, optionalAuth, COOKIE_NAME };
