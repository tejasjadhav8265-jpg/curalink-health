const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema(
  {
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
    date: { type: String },
    summary: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false }
);

// One medical record per patient (demo data only).
const patientRecordSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''], default: '' },
    allergies: [{ type: String, trim: true }],
    chronicConditions: [{ type: String, trim: true }],
    notes: { type: String, trim: true, maxlength: 2000 },
    visits: [visitSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('PatientRecord', patientRecordSchema);
