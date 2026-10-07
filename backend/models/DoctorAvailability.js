const mongoose = require('mongoose');
const { TIME_REGEX, DATE_REGEX, WEEKDAYS } = require('../utils/constants');

// One working window, e.g. { start: '09:00', end: '13:00' }.
const windowSchema = new mongoose.Schema(
  {
    start: { type: String, required: true, match: [TIME_REGEX, 'Use HH:mm (24h) time format.'] },
    end: { type: String, required: true, match: [TIME_REGEX, 'Use HH:mm (24h) time format.'] },
  },
  { _id: false }
);

const weekly = {};
WEEKDAYS.forEach((day) => { weekly[day] = { type: [windowSchema], default: [] }; });

const availabilitySchema = new mongoose.Schema(
  {
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, unique: true },
    slotDuration: { type: Number, enum: [10, 15, 20, 30, 45, 60], default: 30 }, // minutes
    weekly,
    // Dates the doctor is unavailable (leave, holiday): 'YYYY-MM-DD'.
    blockedDates: [{ type: String, match: DATE_REGEX }],
  },
  { timestamps: true }
);

// Extra safety: a window must end after it starts.
availabilitySchema.pre('validate', function checkWindows(next) {
  for (const day of WEEKDAYS) {
    for (const w of this.weekly[day] || []) {
      if (w.start >= w.end) return next(new Error(`On ${day}, end time must be after start time.`));
    }
  }
  next();
});

module.exports = mongoose.model('DoctorAvailability', availabilitySchema);
