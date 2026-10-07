// Single source of truth for enums used by models, validators and controllers.
module.exports = {
  ROLES: ['patient', 'doctor', 'admin'],
  GENDERS: ['male', 'female', 'other'],
  CONSULTATION_TYPES: ['in-person', 'video'],
  APPOINTMENT_STATUSES: ['pending', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'rejected', 'no-show'],
  // Statuses that occupy a slot. Used by the double-booking unique index.
  SLOT_HOLDING_STATUSES: ['pending', 'confirmed', 'rescheduled'],
  PAYMENT_STATUSES: ['pending', 'paid', 'failed', 'refunded'],
  REPORT_TYPES: ['Blood Test', 'X-Ray', 'MRI', 'CT Scan', 'Prescription', 'Discharge Summary', 'Other'],
  NOTIFICATION_TYPES: [
    'registration', 'appointment_confirmation', 'appointment_reminder', 'appointment_cancellation',
    'appointment_rescheduled', 'prescription_available', 'report_uploaded', 'payment_confirmation',
    'doctor_response', 'general',
  ],
  ARTICLE_CATEGORIES: [
    'Cardiology', 'Diabetes', 'Nutrition', "Women's Health", "Children's Health",
    'Orthopedics', 'Skin Care', 'Fitness', 'General Health',
  ],
  WEEKDAYS: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  DATE_REGEX: /^\d{4}-\d{2}-\d{2}$/, // appointment dates are stored as YYYY-MM-DD strings (no timezone drift)
  TIME_REGEX: /^([01]\d|2[0-3]):[0-5]\d$/, // slot times are stored as HH:mm
  INDIAN_MOBILE_REGEX: /^[6-9]\d{9}$/,
  MAX_REPORTS_PER_PATIENT: 30,
  BOOKING_WINDOW_DAYS: 30,   // how far ahead a patient can book
  MAX_RESCHEDULES: 3,        // one appointment can be moved at most this many times
  SLOT_DURATIONS: [10, 15, 20, 30, 45, 60],
  SLOT_TAKEN_MESSAGE: 'Sorry, that time was just booked by someone else. Please choose another time.',
  // Where each role lands after login.
  DASHBOARD_PATHS: {
    patient: '/pages/patient/dashboard.html',
    doctor: '/pages/doctor/dashboard.html',
    admin: '/pages/admin/dashboard.html',
  },
};
