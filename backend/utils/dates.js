// Date helpers. The hospital runs on Indian time, so "today" is always calculated in Asia/Kolkata,
// no matter where the server is. Dates are plain 'YYYY-MM-DD' strings throughout the project.
const TZ = 'Asia/Kolkata';
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // e.g. 2026-10-07

// Current clock time in India as 'HH:mm' (24h), e.g. '09:05'.
const nowTimeIST = () =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// 'monday', 'tuesday', ... for a YYYY-MM-DD string.
function weekdayName(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

module.exports = { TZ, todayIST, nowTimeIST, addDays, weekdayName, isValidDateString };
