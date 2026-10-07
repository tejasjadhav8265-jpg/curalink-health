const mongoose = require('mongoose');

const insuranceSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, required: [true, 'Please select an insurance provider.'], trim: true },
    policyNumber: { type: String, required: [true, 'Please enter your policy number.'], trim: true },
    patientIdRef: { type: String, trim: true }, // the patient's ID printed on the policy/card
    status: { type: String, enum: ['submitted', 'verified', 'rejected'], default: 'submitted' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Insurance', insuranceSchema);
