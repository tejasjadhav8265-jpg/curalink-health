const Doctor = require('../models/Doctor');
const DoctorAvailability = require('../models/DoctorAvailability');
const Appointment = require('../models/Appointment');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { BOOKING_WINDOW_DAYS } = require('../utils/constants');
const { todayIST, nowTimeIST, isValidDateString } = require('../utils/dates');
const { windowsOn } = require('../services/availabilityRules');
const { buildSlotList } = require('../services/slotRules');

// GET /api/doctors/:id/slots?date=YYYY-MM-DD - every slot that day, marked available or not
const getSlots = asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (!isValidDateString(date)) throw ApiError.badRequest('Please select an appointment date.');

  const doctor = await Doctor.findOne({ _id: req.params.id, status: 'active' }).select('_id');
  if (!doctor) throw ApiError.notFound('Doctor not found.');

  const [avail, booked] = await Promise.all([
    DoctorAvailability.findOne({ doctor: doctor._id }).lean(),
    Appointment.find({ doctor: doctor._id, appointmentDate: date, slotLocked: true }).select('slotTime').lean(),
  ]);

  const slots = buildSlotList({
    avail, date, bookedTimes: booked.map((b) => b.slotTime),
    today: todayIST(), nowHM: nowTimeIST(), windowDays: BOOKING_WINDOW_DAYS,
  });

  let message = '';
  if (!slots.length) {
    message = windowsOn(avail, date).length ? 'This date is outside the booking window.' : 'The doctor is not available on this date.';
  } else if (!slots.some((s) => s.available)) {
    message = 'All slots on this date are taken. Please try another day.';
  }
  res.json({ success: true, data: { date, slotDuration: (avail && avail.slotDuration) || 30, slots, message } });
});

module.exports = { getSlots };
