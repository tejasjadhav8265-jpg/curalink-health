const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');

const { port, clientOrigin, isProd } = require('./config/env');
const connectDB = require('./config/db');
const { sanitizeBody } = require('./utils/sanitize');
const { apiLimiter } = require('./middleware/rateLimit');
const { apiNotFound, errorHandler } = require('./middleware/error');

const app = express();
// Behind a host's proxy (Render, Railway...) set TRUST_PROXY=1 so rate limits see real visitor IPs.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

// ---- Security headers (CSP allows only the CDNs this project uses) ----
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        // helmet's default would rewrite http:// to https://, which breaks http://localhost
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
  })
);

app.use(cors({ origin: clientOrigin, credentials: true })); // cookies need credentials + an explicit origin
if (!isProd) app.use(morgan('dev'));

// ---- Body parsing + input hygiene ----
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use(cookieParser());
app.use(mongoSanitize()); // blocks NoSQL operator injection ({"$gt": ""})
app.use(sanitizeBody);    // strips HTML/script from string inputs (XSS)

// ---- API ----
app.use('/api', apiLimiter);
app.use('/api', require('./routes'));
app.use('/api', apiNotFound);

// ---- Frontend (static) ----
app.use(express.static(FRONTEND_DIR, { extensions: ['html'] }));
app.get('/', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'pages', 'public', 'index.html')));
// Non-API unknown URL -> 404 page (added in Phase 9; plain text until then)
app.use((req, res) => {
  const page = path.join(FRONTEND_DIR, 'pages', 'errors', '404.html');
  res.status(404).sendFile(page, (err) => { if (err) res.type('text').send('404 - Page not found'); });
});

app.use(errorHandler);

async function start() {
  try {
    await connectDB();
    app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

if (require.main === module) start();

module.exports = app;
