const mongoose = require('mongoose');

const rating = { type: Number, required: [true, 'Please give a rating from 1 to 5.'], min: 1, max: 5 };

const feedbackSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    // unique -> exactly one review per completed appointment (controller also checks status === 'completed')
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
    doctorRating: rating,
    hospitalRating: rating,
    staffRating: rating,
    comment: { type: String, trim: true, maxlength: 1000 },
    verified: { type: Boolean, default: true }, // always true: only completed visits can review
    status: { type: String, enum: ['visible', 'hidden'], default: 'visible' }, // admin moderation
  },
  { timestamps: true }
);

module.exports = mongoose.model('Feedback', feedbackSchema);
