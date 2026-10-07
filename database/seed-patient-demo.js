// Adds two demo prescriptions and a few notifications to ONE patient account, so you can try the
// Phase 5 pages before doctors can write prescriptions (that arrives in Phase 6).
// Usage:  node database/seed-patient-demo.js your-patient-email@example.com
// Safe to run more than once. Everything it creates is fictional.
const mongoose = require('mongoose');
const { mongoUri } = require('../backend/config/env');
const { User, Doctor, Prescription, Notification } = require('../backend/models');

(async () => {
  const email = (process.argv[2] || '').toLowerCase();
  if (!email) { console.error('Please give the patient email, for example:\n  node database/seed-patient-demo.js you@example.com'); process.exit(1); }

  await mongoose.connect(mongoUri);
  const patient = await User.findOne({ email, role: 'patient' });
  if (!patient) { console.error(`No patient account found for ${email}. Register it first.`); process.exit(1); }

  const doctors = await Doctor.find({ status: 'active' }).sort({ createdAt: 1 }).limit(2);
  if (!doctors.length) { console.error('No doctors found. Run: node database/seed-doctors.js'); process.exit(1); }

  const tag = String(patient._id).slice(-6).toUpperCase();
  const samples = [
    { diagnosis: 'Seasonal viral fever', advice: 'Drink plenty of fluids and rest for 3 days. Return if fever lasts more than 3 days.', followUpDate: '', medicines: [
      { name: 'Paracetamol 500 mg', dosage: '1 tablet', frequency: 'Three times a day, after food', duration: '3 days', instructions: 'Only if temperature is above 100 F' },
      { name: 'Oral rehydration salts', dosage: '1 sachet in 1 litre of water', frequency: 'Sip through the day', duration: '3 days' } ] },
    { diagnosis: 'Mild seasonal allergy', advice: 'Avoid dust and cold drinks. Steam inhalation at night.', followUpDate: '', medicines: [
      { name: 'Cetirizine 10 mg', dosage: '1 tablet', frequency: 'Once at night', duration: '5 days' } ] },
  ];

  for (let i = 0; i < samples.length; i += 1) {
    const doctor = doctors[i % doctors.length];
    const daysAgo = (i + 1) * 9;
    const createdAt = new Date(Date.now() - daysAgo * 86400000);
    await Prescription.updateOne(
      { prescriptionId: `RX-DEMO-${tag}-${i + 1}` },
      { $setOnInsert: { prescriptionId: `RX-DEMO-${tag}-${i + 1}`, patient: patient._id, doctor: doctor._id, createdAt, updatedAt: createdAt, ...samples[i] } },
      { upsert: true, timestamps: false }
    );
  }

  const notes = [
    ['prescription_available', 'New prescription available (demo)', 'Your demo prescription is ready to view and download.', '/pages/patient/prescriptions.html'],
    ['appointment_reminder', 'Appointment reminder (demo)', 'This is a sample reminder to show how notifications look.', '/pages/patient/appointments.html'],
    ['general', 'Welcome to your health portal (demo)', 'Keep your health summary and reports up to date for faster visits.', '/pages/patient/medical-records.html'],
  ];
  for (const [type, title, message, link] of notes) {
    if (!(await Notification.exists({ user: patient._id, title }))) await Notification.create({ user: patient._id, type, title, message, link });
  }

  console.log(`Done. ${patient.firstName} now has ${samples.length} demo prescriptions and ${notes.length} demo notifications.`);
  await mongoose.disconnect();
})().catch((err) => { console.error(err.message); process.exit(1); });
