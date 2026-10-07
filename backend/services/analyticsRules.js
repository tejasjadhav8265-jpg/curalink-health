// Pure helpers for the admin analytics (no database, so they are easy to test).
const { addDays } = require('../utils/dates');

// ['2026-10-01', ..., '2026-10-07'] ending on `today`.
const lastDates = (today, n) => Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));

// Turns [{_id:'2026-10-03', n:4}] into one entry for EVERY date (zero when nothing happened).
function fillSeries(rows, dates) {
  const byDate = new Map(rows.map((r) => [r._id, r.n]));
  return dates.map((date) => ({ date, value: byDate.get(date) || 0 }));
}

// Percentage with one decimal: rate(1, 3) -> 33.3. Zero when there is nothing to divide by.
const rate = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

// 7, 30 or 90 days only; anything else becomes 30.
const clampDays = (value) => ([7, 30, 90].includes(Number(value)) ? Number(value) : 30);

// Start of an India-time calendar day as a real instant (for comparing with timestamps).
const istStart = (dateStr) => new Date(`${dateStr}T00:00:00+05:30`);
const istEnd = (dateStr) => new Date(`${dateStr}T23:59:59.999+05:30`);

// [{_id:'cardiology', n:5}] -> [{label:'cardiology', value:5}] (sorted high to low, top N, rest folded into 'Other').
function topWithOther(rows, limit) {
  const sorted = [...rows].sort((a, b) => b.n - a.n);
  const top = sorted.slice(0, limit).map((r) => ({ label: r._id, value: r.n }));
  const rest = sorted.slice(limit).reduce((t, r) => t + r.n, 0);
  return rest ? [...top, { label: 'Other', value: rest }] : top;
}

module.exports = { lastDates, fillSeries, rate, clampDays, istStart, istEnd, topWithOther };
