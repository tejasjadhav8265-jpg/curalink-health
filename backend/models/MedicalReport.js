const mongoose = require('mongoose');
const { REPORT_TYPES } = require('../utils/constants');

const medicalReportSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fileName: { type: String, required: true, trim: true },     // original name (display only)
    storedName: { type: String, required: true, select: false }, // random name on disk; never trusted from user
    fileType: { type: String, enum: REPORT_TYPES, required: [true, 'Please select a report type.'] },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    description: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: { createdAt: 'uploadDate', updatedAt: 'updatedAt' } }
);

module.exports = mongoose.model('MedicalReport', medicalReportSchema);
