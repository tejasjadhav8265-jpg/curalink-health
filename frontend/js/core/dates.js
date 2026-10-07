// Date helpers for the browser. The hospital runs on Indian time, so "today" is always India's today.
// Dates are plain 'YYYY-MM-DD' strings and times are 'HH:mm' strings, the same as in the backend.
const TZ = 'Asia/Kolkata';

export const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });

export const nowHM = () =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());

export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// '2026-10-05' -> 'Mon, 5 Oct 2026'
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// '14:30' -> '2:30 PM'
export function to12h(hm) {
  if (!hm) return '';
  const [h, m] = hm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// Is this appointment still in the future (India time)?
export const isFuture = (dateStr, timeHM) => {
  const today = todayIST();
  return dateStr > today || (dateStr === today && timeHM > nowHM());
};

// '2026-10-07T04:15:00Z' -> '7 Oct, 9:45 am' (India time)
export function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
export const formatDay = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
