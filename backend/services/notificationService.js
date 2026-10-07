const Notification = require('../models/Notification');

/**
 * Creates an in-app notification. Never throws (notifications are best-effort).
 * Usage: await notify(userId, { type: 'appointment_confirmation', title: '...', message: '...', link: '/pages/patient/appointments.html' })
 */
async function notify(userId, { type = 'general', title, message, link }) {
  try {
    return await Notification.create({ user: userId, type, title, message, link });
  } catch (err) {
    console.error('Notification failed:', err.message);
    return null;
  }
}

module.exports = { notify };
