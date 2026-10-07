const mongoose = require('mongoose');

// One row per search; powers the admin "most searched" analytics.
const doctorSearchSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // optional (anonymous searches allowed)
    keyword: { type: String, trim: true, lowercase: true },
    specialization: { type: String, trim: true, lowercase: true },
    location: { type: String, trim: true, lowercase: true },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} }, // gender, fee range, availableToday...
    resultsCount: { type: Number, default: 0 },
    clickedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' }, // set when a result is opened
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

doctorSearchSchema.index({ createdAt: -1 });
doctorSearchSchema.index({ specialization: 1 });
doctorSearchSchema.index({ location: 1 });
doctorSearchSchema.index({ keyword: 1 });

module.exports = mongoose.model('DoctorSearch', doctorSearchSchema);
