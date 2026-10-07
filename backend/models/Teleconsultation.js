const mongoose = require('mongoose');

// SIMULATED consultation session (no real video service is integrated).
const teleconsultationSchema = new mongoose.Schema(
  {
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    mode: { type: String, enum: ['video', 'audio', 'chat'], default: 'video' },
    status: { type: String, enum: ['scheduled', 'in-progress', 'ended'], default: 'scheduled' },
    startedAt: Date,
    endedAt: Date,
    messages: [{
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      text: { type: String, maxlength: 1000 },
      sentAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Teleconsultation', teleconsultationSchema);
