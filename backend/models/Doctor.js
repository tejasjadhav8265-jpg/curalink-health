const mongoose = require('mongoose');
const { GENDERS, CONSULTATION_TYPES } = require('../utils/constants');

const doctorSchema = new mongoose.Schema(
  {
    // Login account for the doctor (role: 'doctor'). Optional so admins can create profiles first.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true },
    name: { type: String, required: [true, 'Doctor name is required.'], trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    phone: { type: String, trim: true },
    specialization: { type: String, required: [true, 'Specialization is required.'], trim: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    qualification: { type: String, trim: true },
    experience: { type: Number, min: 0, max: 70, default: 0 }, // years
    gender: { type: String, enum: GENDERS },
    languages: [{ type: String, trim: true }],
    registrationNumber: { type: String, required: true, unique: true, trim: true },
    location: { type: String, required: true, trim: true }, // city
    branch: { type: String, trim: true }, // hospital branch
    consultationFee: { type: Number, required: true, min: 0 },
    profileImage: { type: String, default: '/images/doctor-placeholder.svg' },
    about: { type: String, trim: true, maxlength: 3000 },
    conditionsTreated: [{ type: String, trim: true }],
    procedures: [{ type: String, trim: true }],
    consultationTypes: { type: [{ type: String, enum: CONSULTATION_TYPES }], default: ['in-person'] },
    opdTimings: { type: String, trim: true }, // display text, e.g. "Mon-Fri 9:00-13:00"
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  },
  { timestamps: true }
);

// Full-text search on the fields people actually type into the search box.
doctorSchema.index(
  { name: 'text', specialization: 'text', conditionsTreated: 'text', procedures: 'text' },
  { weights: { name: 10, specialization: 8, conditionsTreated: 4, procedures: 2 }, name: 'doctor_text_idx' }
);
doctorSchema.index({ specialization: 1 });
doctorSchema.index({ department: 1, location: 1 });
doctorSchema.index({ status: 1, consultationFee: 1 });
doctorSchema.index({ ratingAvg: -1 });

module.exports = mongoose.model('Doctor', doctorSchema);
