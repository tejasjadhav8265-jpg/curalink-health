const mongoose = require('mongoose');
const { INDIAN_MOBILE_REGEX } = require('../utils/constants');

// Ambulance/emergency request. Works WITHOUT login (user is optional).
const emergencyRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    patientName: { type: String, required: [true, 'Please enter the patient name.'], trim: true, maxlength: 100 },
    phone: { type: String, required: [true, 'Please enter a mobile number.'], match: [INDIAN_MOBILE_REGEX, 'Please enter a valid mobile number.'] },
    pickupLocation: { type: String, required: [true, 'Please enter the pickup location.'], trim: true, maxlength: 300 },
    emergencyType: { type: String, required: [true, 'Please select the emergency type.'], trim: true },
    patientCount: { type: Number, default: 1, min: 1, max: 20 },
    additionalInfo: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: ['new', 'dispatched', 'completed', 'cancelled'], default: 'new', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmergencyRequest', emergencyRequestSchema);
