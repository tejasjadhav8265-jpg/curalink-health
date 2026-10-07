const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, GENDERS, INDIAN_MOBILE_REGEX } = require('../utils/constants');

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: [true, 'Please enter your first name.'], trim: true, maxlength: 50 },
    lastName: { type: String, required: [true, 'Please enter your last name.'], trim: true, maxlength: 50 },
    email: {
      type: String, required: [true, 'Please enter your email.'], unique: true, lowercase: true, trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address.'],
    },
    phone: {
      type: String, required: [true, 'Please enter your mobile number.'], unique: true, trim: true,
      match: [INDIAN_MOBILE_REGEX, 'Please enter a valid mobile number.'],
    },
    // select:false -> never returned by default; request explicitly with .select('+passwordHash').
    passwordHash: { type: String, required: true, select: false },
    gender: { type: String, enum: GENDERS },
    dob: { type: Date },
    address: { type: String, trim: true, maxlength: 300 },
    city: { type: String, trim: true, maxlength: 80 },
    state: { type: String, trim: true, maxlength: 80 },
    emergencyContact: {
      type: String, trim: true,
      match: [INDIAN_MOBILE_REGEX, 'Please enter a valid emergency contact number.'],
    },
    role: { type: String, enum: ROLES, default: 'patient', index: true },
    isActive: { type: Boolean, default: true },
    // Raised whenever the password changes; tokens carrying an older number stop working.
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, 12);

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// Never leak the hash if a user document is serialised.
userSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => { delete ret.passwordHash; delete ret.tokenVersion; delete ret.__v; delete ret.id; return ret; },
});

module.exports = mongoose.model('User', userSchema);
