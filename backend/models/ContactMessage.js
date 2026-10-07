const mongoose = require('mongoose');
const { INDIAN_MOBILE_REGEX } = require('../utils/constants');

const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Please enter your name.'], trim: true, maxlength: 100 },
    email: { type: String, required: [true, 'Please enter your email.'], lowercase: true, trim: true, match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address.'] },
    phone: { type: String, trim: true, match: [INDIAN_MOBILE_REGEX, 'Please enter a valid mobile number.'] },
    subject: { type: String, required: [true, 'Please enter a subject.'], trim: true, maxlength: 150 },
    message: { type: String, required: [true, 'Please enter your message.'], trim: true, maxlength: 2000 },
    status: { type: String, enum: ['new', 'read', 'resolved'], default: 'new' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
