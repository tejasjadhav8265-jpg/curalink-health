// Pure rules for appointment slots (no database access, so they are easy to test).
// Times are 'HH:mm' strings and dates are 'YYYY-MM-DD' strings; both compare correctly as plain text.
const { windowsOn } = require('./availabilityRules');
const { addDays } = require('../utils/dates');

const toMinutes = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
const toHM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// [{start:'09:00', end:'10:30'}] with 30-minute slots -> ['09:00', '09:30', '10:00'].
// A slot must fit completely inside a window.
function generateSlots(windows, duration) {
  const times = new Set();
  for (const w of windows || []) {
    for (let t = toMinutes(w.start); t + duration <= toMinutes(w.end); t += duration) times.add(toHM(t));
  }
  return [...times].sort();
}

// All slot start times the doctor offers on a date (before removing booked ones).
const slotsOnDate = (avail, date) => generateSlots(windowsOn(avail, date), (avail && avail.slotDuration) || 30);

// '' when the slot may be booked, otherwise a message to show the patient.
function checkBookable({ avail, date, time, today, nowHM, windowDays }) {
  if (date < today) return 'You cannot book a date in the past.';
  if (date > addDays(today, windowDays)) return `Appointments can be booked up to ${windowDays} days ahead.`;
  if (!windowsOn(avail, date).length) return 'The doctor is not available on this date.';
  if (!slotsOnDate(avail, date).includes(time)) return "That time is not in the doctor's schedule.";
  if (date === today && time <= nowHM) return 'That time has already passed. Please choose a later time.';
  return '';
}

// The list the booking page shows: every slot with available true/false.
function buildSlotList({ avail, date, bookedTimes = [], today, nowHM, windowDays }) {
  if (date < today || date > addDays(today, windowDays)) return [];
  const booked = new Set(bookedTimes);
  return slotsOnDate(avail, date).map((time) => {
    if (booked.has(time)) return { time, available: false, reason: 'booked' };
    if (date === today && time <= nowHM) return { time, available: false, reason: 'past' };
    return { time, available: true };
  });
}

const formatToken = (seq) => `A-${String(seq).padStart(3, '0')}`;

module.exports = { toMinutes, toHM, generateSlots, slotsOnDate, checkBookable, buildSlotList, formatToken };
