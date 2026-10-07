const mongoose = require('mongoose');

const healthPackageSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Package name is required.'], trim: true, unique: true },
    description: { type: String, trim: true, maxlength: 1000 },
    tests: [{ type: String, trim: true }],
    price: { type: Number, required: true, min: 0 },
    duration: { type: String, trim: true }, // e.g. "3-4 hours"
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('HealthPackage', healthPackageSchema);
