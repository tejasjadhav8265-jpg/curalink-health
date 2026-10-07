const mongoose = require('mongoose');
const crypto = require('crypto');

const medicineSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Medicine name is required.'], trim: true },
    dosage: { type: String, required: [true, 'Dosage is required.'], trim: true },
    frequency: { type: String, required: [true, 'Frequency is required.'], trim: true },
    duration: { type: String, required: [true, 'Duration is required.'], trim: true },
    instructions: { type: String, trim: true },
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    prescriptionId: { type: String, unique: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    diagnosis: { type: String, required: [true, 'Diagnosis is required.'], trim: true, maxlength: 500 },
    medicines: {
      type: [medicineSchema],
      validate: [(v) => v.length > 0, 'Add at least one medicine.'],
    },
    advice: { type: String, trim: true, maxlength: 1000 },
    followUpDate: { type: String },
  },
  { timestamps: true }
);

prescriptionSchema.pre('validate', function setId(next) {
  if (!this.prescriptionId) this.prescriptionId = `RX-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  next();
});

module.exports = mongoose.model('Prescription', prescriptionSchema);
