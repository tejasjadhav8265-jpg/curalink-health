const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // actor (may be empty for anonymous actions)
    action: { type: String, required: true, index: true },       // e.g. 'APPOINTMENT_CANCELLED'
    entity: { type: String },                                    // e.g. 'Appointment'
    entityId: { type: String },
    description: { type: String },
    ip: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
