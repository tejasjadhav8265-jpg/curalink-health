const AuditLog = require('../models/AuditLog');

/**
 * Records an important action. Never throws: a logging failure must not break the user's request.
 * Usage: await audit({ req, user: req.user._id, action: 'DOCTOR_CREATED', entity: 'Doctor', entityId: doc._id, description: '...' })
 */
async function audit({ req, user, action, entity, entityId, description }) {
  try {
    await AuditLog.create({
      user,
      action,
      entity,
      entityId: entityId ? String(entityId) : undefined,
      description,
      ip: req ? req.ip : undefined,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = { audit };
