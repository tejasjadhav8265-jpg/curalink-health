// Loads and validates environment variables once, so the rest of the app
// imports typed values instead of touching process.env directly.
require('dotenv').config();

const required = ['MONGO_URI', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

const nodeEnv = process.env.NODE_ENV || 'development';
if (nodeEnv === 'production' && process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters in production.');
  process.exit(1);
}

module.exports = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  cookieMaxAgeMs: 24 * 60 * 60 * 1000, // keep in sync with JWT_EXPIRES_IN default (1 day)
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5000',
  uploadMaxMb: Number(process.env.UPLOAD_MAX_MB) || 5,
};
