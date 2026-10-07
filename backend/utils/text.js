// Makes user text safe to put inside a regular expression (so "a.b" is not treated as a pattern).
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Reads a whole number from user input, keeping it between min and max (falls back to `fallback`).
const clampInt = (value, min, max, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
};

module.exports = { escapeRegex, clampInt };
