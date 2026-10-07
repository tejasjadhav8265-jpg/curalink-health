// Checks a weekly schedule sent by a doctor. Returns { error } or { weekly } (cleaned, every day present).
const { WEEKDAYS, TIME_REGEX } = require('../utils/constants');
const { toMinutes } = require('../services/slotRules');

const MAX_WINDOWS_PER_DAY = 4;
const label = (day) => day.charAt(0).toUpperCase() + day.slice(1);

function validateWeekly(input, slotDuration) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Please send your weekly timings.' };
  const unknown = Object.keys(input).find((k) => !WEEKDAYS.includes(k));
  if (unknown) return { error: `Unknown day: ${String(unknown).slice(0, 20)}.` };

  const weekly = {};
  for (const day of WEEKDAYS) {
    const windows = input[day] === undefined ? [] : input[day];
    if (!Array.isArray(windows)) return { error: `${label(day)}: timings must be a list.` };
    if (windows.length > MAX_WINDOWS_PER_DAY) return { error: `${label(day)}: add at most ${MAX_WINDOWS_PER_DAY} time ranges.` };

    const cleaned = [];
    for (const w of windows) {
      if (!w || typeof w.start !== 'string' || typeof w.end !== 'string' || !TIME_REGEX.test(w.start) || !TIME_REGEX.test(w.end)) {
        return { error: `${label(day)}: please enter valid start and end times.` };
      }
      if (toMinutes(w.end) <= toMinutes(w.start)) return { error: `${label(day)}: the end time must be after the start time.` };
      if (toMinutes(w.end) - toMinutes(w.start) < slotDuration) {
        return { error: `${label(day)}: each time range must be at least ${slotDuration} minutes long.` };
      }
      cleaned.push({ start: w.start, end: w.end });
    }
    cleaned.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    for (let i = 1; i < cleaned.length; i += 1) {
      if (toMinutes(cleaned[i].start) < toMinutes(cleaned[i - 1].end)) return { error: `${label(day)}: time ranges must not overlap.` };
    }
    weekly[day] = cleaned;
  }
  return { weekly };
}

module.exports = { validateWeekly };
