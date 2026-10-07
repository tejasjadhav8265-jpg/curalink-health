// Pure rules for what a doctor may do with an appointment (no database, so it is easy to test).
// Dates are 'YYYY-MM-DD' and times 'HH:mm'; both compare correctly as plain text.
const HOLDING = ['pending', 'confirmed', 'rescheduled'];

const ACTIONS = {
  confirm: { from: ['pending', 'rescheduled'], to: 'confirmed', reason: false },
  reject: { from: ['pending', 'rescheduled'], to: 'rejected', reason: true },
  complete: { from: ['confirmed'], to: 'completed', reason: false },
  'no-show': { from: ['confirmed'], to: 'no-show', reason: false },
  cancel: { from: HOLDING, to: 'cancelled', reason: true },
};

// '' when the action is allowed, otherwise a message for the doctor.
function checkDoctorAction({ action, appt, today, nowHM }) {
  const rule = ACTIONS[action];
  if (!rule) return 'Unknown action.';

  if (!rule.from.includes(appt.status)) {
    if (action === 'confirm' || action === 'reject') return 'Only pending requests can be confirmed or declined.';
    if (action === 'cancel') return 'This appointment can no longer be cancelled.';
    return appt.status === 'pending' || appt.status === 'rescheduled'
      ? 'Please confirm this appointment first.'
      : 'Only confirmed appointments can be marked completed or no-show.';
  }

  if (['confirm', 'reject', 'cancel'].includes(action) && appt.appointmentDate < today) return 'This appointment date has already passed.';
  if (action === 'complete' && appt.appointmentDate > today) return 'You cannot complete a visit that has not happened yet.';
  if (action === 'no-show' && (appt.appointmentDate > today || (appt.appointmentDate === today && appt.slotTime > nowHM))) {
    return 'You can mark a no-show only after the appointment time has passed.';
  }
  return '';
}

module.exports = { ACTIONS, HOLDING, checkDoctorAction };
