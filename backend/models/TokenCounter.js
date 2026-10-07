const mongoose = require('mongoose');

// One counter per doctor per day. $inc on it is atomic, so two patients can never receive the same token number.
const tokenCounterSchema = new mongoose.Schema(
  {
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);
tokenCounterSchema.index({ doctor: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('TokenCounter', tokenCounterSchema);
