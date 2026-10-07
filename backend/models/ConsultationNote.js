const mongoose = require('mongoose');

const consultationNoteSchema = new mongoose.Schema(
  {
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    symptoms: { type: String, trim: true, maxlength: 2000 },
    observations: { type: String, trim: true, maxlength: 2000 },
    note: { type: String, required: [true, 'Please write a consultation note.'], trim: true, maxlength: 4000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ConsultationNote', consultationNoteSchema);
