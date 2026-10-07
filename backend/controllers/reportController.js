const MedicalReport = require('../models/MedicalReport');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { REPORT_TYPES, MAX_REPORTS_PER_PATIENT } = require('../utils/constants');
const { clean } = require('../utils/sanitize');
const { ALLOWED, looksLikeItsExtension, pathFor, removeFile } = require('../middleware/upload');
const { audit } = require('../services/auditService');
const { notify } = require('../services/notificationService');
const path = require('path');

const shape = (r) => ({ _id: r._id, fileName: r.fileName, fileType: r.fileType, mimeType: r.mimeType, size: r.size, description: r.description || '', uploadDate: r.uploadDate });

// POST /api/reports  (multipart/form-data: file, fileType, description)
// Everything is checked here; if anything is wrong the already-saved temporary file is deleted.
const upload = asyncHandler(async (req, res) => {
  const file = req.file;
  const reject = async (message) => { if (file) await removeFile(file.path); throw ApiError.badRequest(message); };

  if (!file) throw ApiError.badRequest('Please choose a file to upload.');
  const fileType = clean(req.body.fileType || '');
  const description = clean(req.body.description || '').slice(0, 500);
  if (!REPORT_TYPES.includes(fileType)) await reject('Please select a report type.');
  if (!looksLikeItsExtension(file.path)) await reject('This file does not look like a real PDF, JPG or PNG.');
  if ((await MedicalReport.countDocuments({ patient: req.user._id })) >= MAX_REPORTS_PER_PATIENT) {
    await reject(`You can keep up to ${MAX_REPORTS_PER_PATIENT} reports. Please delete an old one first.`);
  }

  const ext = path.extname(file.originalname).toLowerCase();
  let report;
  try {
    report = await MedicalReport.create({
      patient: req.user._id, uploadedBy: req.user._id,
      fileName: clean(path.basename(file.originalname)).slice(0, 120) || 'report',
      storedName: file.filename, fileType, mimeType: ALLOWED[ext][0], size: file.size, description,
    });
  } catch (err) { await removeFile(file.path); throw err; }

  await notify(req.user._id, { type: 'report_uploaded', title: 'Report uploaded', message: `${report.fileName} was added to your medical records.`, link: '/pages/patient/medical-records.html' });
  await audit({ req, user: req.user._id, action: 'REPORT_UPLOADED', entity: 'MedicalReport', entityId: report._id, description: `${fileType}: ${report.fileName}` });
  res.status(201).json({ success: true, message: 'Report uploaded.', data: { report: shape(report) } });
});

// GET /api/reports
const list = asyncHandler(async (req, res) => {
  const reports = await MedicalReport.find({ patient: req.user._id }).sort({ uploadDate: -1 }).lean();
  res.json({ success: true, data: { reports: reports.map(shape), maxReports: MAX_REPORTS_PER_PATIENT } });
});

async function owned(req) {
  const report = await MedicalReport.findOne({ _id: req.params.id, patient: req.user._id }).select('+storedName');
  if (!report) throw ApiError.notFound('Report not found.');
  return report;
}

// GET /api/reports/:id/download  (only the owner; the file is never reachable by URL guessing)
const download = asyncHandler(async (req, res) => {
  const report = await owned(req);
  res.setHeader('Content-Type', report.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.download(pathFor(report.storedName), report.fileName, (err) => {
    if (err && !res.headersSent) res.status(404).json({ success: false, message: 'This file is no longer available.' });
  });
});

// DELETE /api/reports/:id
const remove = asyncHandler(async (req, res) => {
  const report = await owned(req);
  await removeFile(pathFor(report.storedName));
  await report.deleteOne();
  await audit({ req, user: req.user._id, action: 'REPORT_DELETED', entity: 'MedicalReport', entityId: report._id, description: report.fileName });
  res.json({ success: true, message: 'Report deleted.' });
});

module.exports = { upload, list, download, remove };
