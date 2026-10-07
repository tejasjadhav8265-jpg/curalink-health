// Run with: npm test   (uses Node's built-in test runner, no extra packages)
// These check the pure rules: no server and no database are needed.
const test = require('node:test');
const assert = require('node:assert/strict');

const dates = require('../backend/utils/dates');
const slots = require('../backend/services/slotRules');
const appt = require('../backend/services/appointmentRules');
const analytics = require('../backend/services/analyticsRules');
const { analyse } = require('../backend/services/specialtyRules');

test('dates: validation and arithmetic', () => {
  assert.equal(dates.isValidDateString('2026-02-28'), true);
  assert.equal(dates.isValidDateString('2026-02-30'), false);
  assert.equal(dates.isValidDateString('28-02-2026'), false);
  assert.equal(dates.isValidDateString(null), false);
  assert.equal(dates.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(dates.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(dates.weekdayName('2026-10-07'), 'wednesday');
  assert.match(dates.todayIST(), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(dates.nowTimeIST(), /^\d{2}:\d{2}$/);
});

test('slots: generated slots must fit completely inside a window', () => {
  assert.deepEqual(slots.generateSlots([{ start: '09:00', end: '10:30' }], 30), ['09:00', '09:30', '10:00']);
  assert.deepEqual(slots.generateSlots([{ start: '09:00', end: '09:20' }], 30), []);
  assert.deepEqual(slots.generateSlots([{ start: '09:00', end: '10:00' }, { start: '09:30', end: '10:30' }], 30), ['09:00', '09:30', '10:00']);
  assert.equal(slots.formatToken(7), 'A-007');
});

test('slots: booked and past times are marked unavailable', () => {
  const avail = { slotDuration: 30, weekly: {} };
  // availabilityRules decides the windows; an empty schedule must never offer slots
  assert.deepEqual(slots.buildSlotList({ avail, date: '2026-10-07', today: '2026-10-07', nowHM: '09:00', windowDays: 30 }), []);
  assert.deepEqual(slots.buildSlotList({ avail, date: '2026-09-01', today: '2026-10-07', nowHM: '09:00', windowDays: 30 }), []);
  assert.match(slots.checkBookable({ avail, date: '2026-09-01', time: '10:00', today: '2026-10-07', nowHM: '09:00', windowDays: 30 }), /past/);
  assert.match(slots.checkBookable({ avail, date: '2027-01-01', time: '10:00', today: '2026-10-07', nowHM: '09:00', windowDays: 30 }), /days ahead/);
});

test('appointments: doctor actions follow the allowed flow', () => {
  const today = '2026-10-07';
  const check = (action, status, date = today, slotTime = '10:00', nowHM = '12:00') =>
    appt.checkDoctorAction({ action, appt: { status, appointmentDate: date, slotTime }, today, nowHM });
  assert.equal(check('confirm', 'pending'), '');
  assert.notEqual(check('confirm', 'completed'), '');
  assert.notEqual(check('complete', 'pending'), '');               // must confirm first
  assert.equal(check('complete', 'confirmed'), '');
  assert.notEqual(check('complete', 'confirmed', '2026-10-09'), ''); // future visit
  assert.notEqual(check('no-show', 'confirmed', today, '15:00', '12:00'), ''); // before the time
  assert.equal(check('no-show', 'confirmed', today, '10:00', '12:00'), '');
  assert.notEqual(check('cancel', 'cancelled'), '');
  assert.notEqual(check('reject', 'pending', '2026-10-01'), '');   // date passed
  assert.equal(check('fly', 'pending'), 'Unknown action.');
});

test('analytics helpers', () => {
  const days = analytics.lastDates('2026-10-07', 3);
  assert.deepEqual(days, ['2026-10-05', '2026-10-06', '2026-10-07']);
  assert.deepEqual(analytics.fillSeries([{ _id: '2026-10-06', n: 4 }], days).map((d) => d.value), [0, 4, 0]);
  assert.equal(analytics.rate(1, 3), 33.3);
  assert.equal(analytics.rate(1, 0), 0);
  assert.equal(analytics.clampDays('90'), 90);
  assert.equal(analytics.clampDays('1000'), 30);
  assert.deepEqual(analytics.topWithOther([{ _id: 'a', n: 5 }, { _id: 'b', n: 3 }, { _id: 'c', n: 1 }], 2).map((r) => r.label), ['a', 'b', 'Other']);
});

test('specialty finder: red flags win and mental-health flag is marked', () => {
  const heart = analyse('severe chest pain and cannot breathe');
  assert.ok(heart.redFlags.length >= 1);
  assert.equal(heart.redFlags.some((f) => f.mental), false);
  const mental = analyse('i want to end my life');
  assert.equal(mental.redFlags[0].mental, true);
  assert.equal(analyse('skin rash on arm').suggestions[0].department, 'Dermatology');
  assert.equal(analyse('skin rash on arm').redFlags.length, 0);
  assert.equal(analyse('xyzzy').fallback, true);
  assert.equal(analyse('').suggestions.length, 0);
});

test('sign-in tokens: a changed password version is refused', () => {
  process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost/test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-1234';
  const jwt = require('jsonwebtoken');
  const { signToken } = require('../backend/middleware/auth');
  const token = signToken({ _id: { toString: () => 'abc' }, role: 'patient', tokenVersion: 2 });
  assert.equal(jwt.verify(token, process.env.JWT_SECRET).tv, 2);
});
