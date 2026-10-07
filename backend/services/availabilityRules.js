// Pure rules about a doctor's weekly schedule (no database access, so they are easy to test).
// `avail` is a DoctorAvailability document: { weekly: { monday: [{start,end}], ... }, blockedDates: ['YYYY-MM-DD'] }
const { weekdayName } = require('../utils/dates');
const { WEEKDAYS } = require('../utils/constants');

const SHORT = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

// The working windows on a given date ([] if closed, on leave, or no schedule).
function windowsOn(avail, dateStr) {
  if (!avail) return [];
  if ((avail.blockedDates || []).includes(dateStr)) return [];
  return (avail.weekly && avail.weekly[weekdayName(dateStr)]) || [];
}

// Is the doctor working on that date? When nowHM ('HH:mm') is given (for "today"),
// windows that have already ended don't count.
function isAvailableOn(avail, dateStr, nowHM = null) {
  const windows = windowsOn(avail, dateStr);
  if (!windows.length) return false;
  return nowHM ? windows.some((w) => w.end > nowHM) : true;
}

// ['Mon', 'Tue', ...] in week order.
function workingDays(avail) {
  if (!avail || !avail.weekly) return [];
  return WEEKDAYS.filter((day) => (avail.weekly[day] || []).length > 0).map((day) => SHORT[day]);
}

module.exports = { windowsOn, isAvailableOn, workingDays, SHORT };
