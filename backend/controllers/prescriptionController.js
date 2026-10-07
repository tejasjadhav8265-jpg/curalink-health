const Prescription = require('../models/Prescription');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const Appointment = require('../models/Appointment');
const { clampInt } = require('../utils/text');
const { audit } = require('../services/auditService');
const { notify } = require('../services/notificationService');

// Patients see their own, doctors see the ones they wrote, admins see all.
async function scopeFor(user) {
  if (user.role === 'patient') return { patient: user._id };
  if (user.role === 'doctor') {
    const doctor = await Doctor.findOne({ user: user._id }).select('_id');
    if (!doctor) throw ApiError.forbidden('No doctor profile is linked to this account.');
    return { doctor: doctor._id };
  }
  return {};
}

const withDoctor = (q, role = 'patient') => {
  q.populate('doctor', 'name specialization qualification registrationNumber');
  if (role !== 'patient') q.populate('patient', 'firstName lastName gender'); // doctors and admins see who it is for
  return q;
};

// GET /api/prescriptions?page=1&limit=10
const list = asyncHandler(async (req, res) => {
  const scope = await scopeFor(req.user);
  const page = clampInt(req.query.page, 1, 10000, 1);
  const limit = clampInt(req.query.limit, 1, 50, 10);
  const [total, items] = await Promise.all([
    Prescription.countDocuments(scope),
    withDoctor(Prescription.find(scope).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), req.user.role).select('-__v').lean(),
  ]);
  res.json({ success: true, data: { prescriptions: items, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } } });
});

async function findOne(req) {
  const scope = await scopeFor(req.user);
  const rx = await withDoctor(Prescription.findOne({ _id: req.params.id, ...scope }), req.user.role).lean();
  if (!rx) throw ApiError.notFound('Prescription not found.');
  return rx;
}

// GET /api/prescriptions/:id
const getOne = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { prescription: await findOne(req) } });
});

// Standard PDF fonts only know Western letters, so anything else becomes '?'.
const pdfSafe = (v) => String(v ?? '').replace(/[^\x20-\x7E -ÿ]/g, '?');
const istDate = (d) => new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });

// GET /api/prescriptions/:id/pdf
const pdf = asyncHandler(async (req, res) => {
  const rx = await findOne(req);
  const patient = await User.findById((rx.patient && rx.patient._id) || rx.patient).select('firstName lastName gender dob').lean();

  let PDFDocument;
  try { PDFDocument = require('pdfkit'); } catch (_) { throw ApiError.badRequest('PDF download is not available right now.'); }

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="prescription-${rx.prescriptionId}.pdf"`);
  doc.pipe(res);

  const d = rx.doctor || {};
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#0F6E6A').text('CuraLink Health');
  doc.font('Helvetica').fontSize(10).fillColor('#566F7A').text('Prescription (demo document)');
  doc.moveDown(0.6).strokeColor('#DAE5E7').moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.8);

  doc.fillColor('#0E2A33').font('Helvetica-Bold').fontSize(12).text(pdfSafe(d.name || 'Doctor'));
  doc.font('Helvetica').fontSize(10).text(pdfSafe([d.specialization, d.qualification].filter(Boolean).join(' | ')));
  if (d.registrationNumber) doc.text(`Registration no: ${pdfSafe(d.registrationNumber)}`);
  doc.moveDown(0.8);

  doc.font('Helvetica-Bold').text('Patient: ', { continued: true }).font('Helvetica')
    .text(pdfSafe(patient ? `${patient.firstName} ${patient.lastName}` : ''));
  doc.font('Helvetica-Bold').text('Date: ', { continued: true }).font('Helvetica').text(istDate(rx.createdAt));
  doc.font('Helvetica-Bold').text('Prescription ID: ', { continued: true }).font('Helvetica').text(pdfSafe(rx.prescriptionId));
  doc.moveDown(0.8);

  doc.font('Helvetica-Bold').fontSize(12).text('Diagnosis');
  doc.font('Helvetica').fontSize(10).text(pdfSafe(rx.diagnosis));
  doc.moveDown(0.8);

  doc.font('Helvetica-Bold').fontSize(12).text('Medicines');
  doc.moveDown(0.3);
  rx.medicines.forEach((m, i) => {
    doc.font('Helvetica-Bold').fontSize(10).text(`${i + 1}. ${pdfSafe(m.name)}`);
    doc.font('Helvetica').text(pdfSafe(`Dosage: ${m.dosage}   Frequency: ${m.frequency}   Duration: ${m.duration}`), { indent: 14 });
    if (m.instructions) doc.text(pdfSafe(`Instructions: ${m.instructions}`), { indent: 14 });
    doc.moveDown(0.4);
  });

  if (rx.advice) { doc.moveDown(0.4).font('Helvetica-Bold').fontSize(12).text('Advice'); doc.font('Helvetica').fontSize(10).text(pdfSafe(rx.advice)); }
  if (rx.followUpDate) { doc.moveDown(0.6).font('Helvetica-Bold').fontSize(10).text('Follow-up date: ', { continued: true }).font('Helvetica').text(pdfSafe(rx.followUpDate)); }

  doc.moveDown(2).font('Helvetica-Oblique').fontSize(8).fillColor('#566F7A')
    .text('This is a demo prescription created for an educational project. It is not a real medical document.', { align: 'center' });
  doc.end();
});

// Only the cleaned fields a doctor may set (never patient, doctor or id from the request).
const rxFields = (b) => ({
  diagnosis: b.diagnosis,
  medicines: b.medicines.map((m) => ({ name: m.name, dosage: m.dosage, frequency: m.frequency, duration: m.duration, instructions: m.instructions || undefined })),
  advice: b.advice || '',
  followUpDate: b.followUpDate || '',
});

// POST /api/prescriptions  (doctor) { appointmentId, diagnosis, medicines[], advice, followUpDate }
const create = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findOne({ user: req.user._id }).select('_id name');
  if (!doctor) throw ApiError.forbidden('No doctor profile is linked to this account.');
  const appt = await Appointment.findOne({ _id: req.body.appointmentId, doctor: doctor._id });
  if (!appt) throw ApiError.notFound('Appointment not found.');
  if (!['confirmed', 'completed'].includes(appt.status)) throw ApiError.badRequest('Please confirm this appointment before writing a prescription.');
  if (await Prescription.exists({ appointment: appt._id })) throw ApiError.conflict('A prescription already exists for this appointment. Please edit it instead.');

  const rx = await Prescription.create({ ...rxFields(req.body), patient: appt.patient, doctor: doctor._id, appointment: appt._id });
  await notify(appt.patient, { type: 'prescription_available', title: 'New prescription available', message: `${doctor.name} wrote a prescription for you.`, link: '/pages/patient/prescriptions.html' });
  await audit({ req, user: req.user._id, action: 'PRESCRIPTION_CREATED', entity: 'Prescription', entityId: rx._id, description: `${doctor.name} wrote ${rx.prescriptionId}` });
  res.status(201).json({ success: true, message: 'Prescription saved.', data: { prescription: { _id: rx._id, prescriptionId: rx.prescriptionId } } });
});

// PUT /api/prescriptions/:id  (the doctor who wrote it)
const update = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findOne({ user: req.user._id }).select('_id name');
  if (!doctor) throw ApiError.forbidden('No doctor profile is linked to this account.');
  const rx = await Prescription.findOne({ _id: req.params.id, doctor: doctor._id });
  if (!rx) throw ApiError.notFound('Prescription not found.');
  rx.set(rxFields(req.body));
  await rx.save();
  await notify(rx.patient, { type: 'prescription_available', title: 'Prescription updated', message: `${doctor.name} updated your prescription ${rx.prescriptionId}.`, link: '/pages/patient/prescriptions.html' });
  await audit({ req, user: req.user._id, action: 'PRESCRIPTION_UPDATED', entity: 'Prescription', entityId: rx._id, description: `${doctor.name} updated ${rx.prescriptionId}` });
  res.json({ success: true, message: 'Prescription updated.', data: { prescription: { _id: rx._id, prescriptionId: rx.prescriptionId } } });
});

module.exports = { list, getOne, pdf, create, update };
