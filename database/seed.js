// ONE command that fills the whole demo: departments, doctors, health packages, articles, (admin), and three
// demo patients with appointments in every status, payments, prescriptions, reviews and requests.
//
//   npm run seed              adds everything that is missing (safe to run again)
//   npm run seed -- --reset   first removes the demo patients' appointments, payments, prescriptions, reviews
//                             and requests, then adds them again fresh (dates move to "today")
//
// Everything is fictional. Demo logins are printed at the end.
const path = require('path');
const { spawnSync } = require('child_process');
const mongoose = require('mongoose');
const { mongoUri } = require('../backend/config/env');
const M = require('../backend/models');
const { todayIST, addDays } = require('../backend/utils/dates');
const { slotsOnDate } = require('../backend/services/slotRules');
const { nextToken } = require('../backend/services/tokenService');
const { applyRating } = require('../backend/controllers/feedbackController');

const RESET = process.argv.includes('--reset');
const ROOT = path.join(__dirname, '..');
const DEMO_DOMAIN = '@curalink-demo.test';
const PASSWORD = process.env.SEED_PATIENT_PASSWORD || 'Patient@12345';

function runScript(file) {
  const r = spawnSync(process.execPath, [path.join(__dirname, file)], { cwd: ROOT, stdio: 'inherit', env: process.env });
  if (r.status !== 0) { console.error(`\n${file} failed. Fix the message above, then run the seed again.`); process.exit(1); }
}

const PATIENTS = [
  { firstName: 'Priya', lastName: 'Deshmukh', phone: '9200000001', gender: 'female', city: 'Nashik', dob: '1992-03-14', blood: 'B+', allergies: ['Dust'], conditions: [] },
  { firstName: 'Rohan', lastName: 'Kulkarni', phone: '9200000002', gender: 'male', city: 'Pune', dob: '1985-11-02', blood: 'O+', allergies: [], conditions: ['Seasonal allergy'] },
  { firstName: 'Sneha', lastName: 'Patil', phone: '9200000003', gender: 'female', city: 'Mumbai', dob: '1998-07-21', blood: 'A+', allergies: ['Penicillin'], conditions: [] },
];

const RX = {
  fever: { diagnosis: 'Seasonal viral fever', advice: 'Rest, drink plenty of fluids. Return if fever lasts more than 3 days.', medicines: [
    { name: 'Paracetamol 500 mg', dosage: '1 tablet', frequency: 'Three times a day, after food', duration: '3 days', instructions: 'Only if temperature is above 100 F' },
    { name: 'Oral rehydration salts', dosage: '1 sachet in 1 litre water', frequency: 'Sip through the day', duration: '3 days' }] },
  tooth: { diagnosis: 'Tooth cavity, filling done', advice: 'Avoid very hot or cold food for 24 hours. Brush gently twice a day.', medicines: [
    { name: 'Ibuprofen 400 mg', dosage: '1 tablet', frequency: 'Twice a day, after food', duration: '2 days', instructions: 'Only if there is pain' }] },
  sinus: { diagnosis: 'Sinusitis', advice: 'Steam inhalation twice a day. Avoid cold drinks.', followUpDate: '', medicines: [
    { name: 'Saline nasal spray', dosage: '2 sprays each side', frequency: 'Twice a day', duration: '7 days' },
    { name: 'Cetirizine 10 mg', dosage: '1 tablet', frequency: 'Once at night', duration: '5 days' }] },
};

(async () => {
  // ---- 1. base content (each script is safe to repeat) ----
  console.log('Step 1/3: departments and doctors...'); runScript('seed-doctors.js');
  console.log('Step 2/3: health packages and articles...'); runScript('seed-content.js');
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) { console.log('Admin account...'); runScript('seed-admin.js'); }
  else console.log('(No ADMIN_EMAIL / ADMIN_PASSWORD in .env, so the admin account was not touched. Run: npm run seed:admin)');

  // ---- 2. demo patients and their history ----
  console.log('Step 3/3: demo patients and history...');
  await mongoose.connect(mongoUri);
  const today = todayIST();

  if (RESET) {
    const old = await M.User.find({ role: 'patient', email: new RegExp(`${DEMO_DOMAIN.replace('.', '\\.')}$`) }).select('_id');
    const ids = old.map((u) => u._id);
    await Promise.all([
      M.Appointment.deleteMany({ patient: { $in: ids } }), M.Payment.deleteMany({ patient: { $in: ids } }), M.Prescription.deleteMany({ patient: { $in: ids } }),
      M.Feedback.deleteMany({ patient: { $in: ids } }), M.Notification.deleteMany({ user: { $in: ids } }), M.PatientRecord.deleteMany({ patient: { $in: ids } }),
      M.Insurance.deleteMany({ patient: { $in: ids } }), M.PackageBooking.deleteMany({ patient: { $in: ids } }), M.EmergencyRequest.deleteMany({ user: { $in: ids } }),
      M.Teleconsultation.deleteMany({ patient: { $in: ids } }), M.ContactMessage.deleteMany({ email: new RegExp(`${DEMO_DOMAIN.replace('.', '\\.')}$`) }),
    ]);
    console.log(`  Reset: cleared the demo history of ${ids.length} demo patients.`);
  }

  const doctors = await M.Doctor.find({ status: 'active' }).lean();
  if (!doctors.length) { console.error('No doctors found. Something went wrong in step 1.'); process.exit(1); }
  const byName = (n) => doctors.find((d) => d.name === n) || doctors[0];
  const avails = new Map((await M.DoctorAvailability.find({ doctor: { $in: doctors.map((d) => d._id) } }).lean()).map((a) => [String(a.doctor), a]));
  const used = new Set();

  const pickDate = (doc, from, dir) => {
    const a = avails.get(String(doc._id));
    for (let i = 0; i < 30; i += 1) { const d = addDays(from, dir * i); if (slotsOnDate(a, d).length) return d; }
    return null;
  };
  // A free time: not used by this seed run and not already held by a real booking in the database.
  const pickTime = async (doc, date) => {
    for (const t of slotsOnDate(avails.get(String(doc._id)), date)) {
      if (used.has(`${doc._id}|${date}|${t}`)) continue;
      if (await M.Appointment.exists({ doctor: doc._id, appointmentDate: date, slotTime: t, slotLocked: true })) continue;
      return t;
    }
    return null;
  };

  async function book({ patient, doctor, offset, status, type, reason, paid = false, refunded = false, history = false, cancelReason, exactToday = false }) {
    const date = pickDate(doctor, addDays(today, offset), offset < 0 ? -1 : 1);
    if (!date || (exactToday && date !== today)) return null;
    const time = await pickTime(doctor, date);
    if (!time) return null;
    used.add(`${doctor._id}|${date}|${time}`);
    const token = await nextToken(doctor._id, date);
    const appt = new M.Appointment({
      patient: patient._id, doctor: doctor._id, department: doctor.department, appointmentDate: date, slotTime: time, status, reason,
      consultationType: type && doctor.consultationTypes.includes(type) ? type : doctor.consultationTypes[0],
      paymentStatus: refunded ? 'refunded' : paid ? 'paid' : 'pending', ...token,
      ...(history ? { rescheduleHistory: [{ oldDate: addDays(date, -2), oldTime: time, newDate: date, newTime: time, reason: 'Needed a different day' }] } : {}),
      ...(cancelReason ? { cancellationReason: cancelReason, cancelledAt: new Date(), ...(status === 'cancelled' ? { cancelledBy: patient._id } : {}) } : {}),
    });
    await appt.save();
    if (paid || refunded) {
      await M.Payment.create({ patient: patient._id, type: 'appointment', appointment: appt._id, amount: doctor.consultationFee, status: refunded ? 'refunded' : 'paid', method: 'DEMO', transactionRef: `DEMO-${String(appt._id).slice(-8).toUpperCase()}`, paidAt: new Date() });
    }
    return appt;
  }

  const complete = async ({ patient, doctor, offset, rx, review, reason }) => {
    const appt = await book({ patient, doctor, offset, status: 'completed', paid: true, reason });
    if (!appt) return null;
    if (rx) await M.Prescription.create({ patient: patient._id, doctor: doctor._id, appointment: appt._id, ...rx });
    await M.PatientRecord.updateOne({ patient: patient._id }, { $push: { visits: { appointment: appt._id, doctor: doctor._id, date: appt.appointmentDate, summary: rx ? rx.diagnosis : 'Routine consultation' } } });
    if (review) {
      await M.Feedback.create({ patient: patient._id, doctor: doctor._id, appointment: appt._id, doctorRating: review[0], hospitalRating: review[1], staffRating: review[2], comment: review[3] });
      await applyRating(doctor._id, review[0], +1);
    }
    return appt;
  };

  const passwordHash = await M.User.hashPassword(PASSWORD);
  const menon = byName('Dr. Harish Menon'); const mehta = byName('Dr. Anjali Mehta'); const shah = byName('Dr. Aditya Shah');
  const nair = byName('Dr. Rajesh Nair'); const thakur = byName('Dr. Manoj Thakur'); const gupta = byName('Dr. Ishita Gupta'); const naik = byName('Dr. Suresh Naik'); const iyer = byName('Dr. Pooja Iyer');
  let made = 0;
  const people = [];

  for (const p of PATIENTS) {
    const email = `${p.firstName}.${p.lastName}${DEMO_DOMAIN}`.toLowerCase();
    const patient = await M.User.findOneAndUpdate(
      { email },
      { $set: { role: 'patient', isActive: true }, $setOnInsert: { firstName: p.firstName, lastName: p.lastName, email, phone: p.phone, passwordHash, gender: p.gender, city: p.city, dob: new Date(p.dob) } },
      { upsert: true, new: true }
    );
    people.push({ name: `${p.firstName} ${p.lastName}`, email });
    if (await M.Appointment.exists({ patient: patient._id })) { console.log(`  ${email}: already has demo history, skipped (use --reset to rebuild).`); continue; }
    await M.PatientRecord.updateOne({ patient: patient._id }, { $set: { bloodGroup: p.blood, allergies: p.allergies, chronicConditions: p.conditions, notes: 'Demo record. Fictional.' } }, { upsert: true });
    const ctx = { patient };

    if (p.firstName === 'Priya') {
      await complete({ ...ctx, doctor: menon, offset: -14, rx: RX.fever, review: [5, 5, 4, 'Very clear explanation and no waiting.'], reason: 'Fever and body ache' });
      await complete({ ...ctx, doctor: mehta, offset: -30, review: [4, 4, 5, 'Kind and patient. Staff were helpful.'], reason: 'Routine check-up' });
      await book({ ...ctx, doctor: menon, offset: 2, status: 'confirmed', paid: true, reason: 'Follow-up visit' });
      await book({ ...ctx, doctor: shah, offset: 5, status: 'pending', reason: 'Tooth sensitivity' });
      const vdoc = doctors.filter((d) => d.consultationTypes.includes('video')).find((d) => pickDate(d, today, 1) === today);
      if (vdoc) await book({ ...ctx, doctor: vdoc, offset: 0, status: 'confirmed', type: 'video', paid: true, reason: 'Video follow-up', exactToday: true });
      else console.log('  (No video doctor works today, so no video appointment was created for today. Try again on a weekday.)');
    }
    if (p.firstName === 'Rohan') {
      await complete({ ...ctx, doctor: shah, offset: -7, rx: RX.tooth, reason: 'Toothache' }); // no review yet: the Reviews page has something to show
      await book({ ...ctx, doctor: nair, offset: -3, status: 'cancelled', reason: 'Headache', cancelReason: 'Travelling that day' });
      await book({ ...ctx, doctor: menon, offset: -10, status: 'no-show', reason: 'Cough' });
      await book({ ...ctx, doctor: gupta, offset: -5, status: 'rejected', reason: 'Dizziness', cancelReason: 'Doctor unavailable on this day. Please book another slot.' });
      await book({ ...ctx, doctor: iyer, offset: 3, status: 'rescheduled', history: true, reason: 'Allergic rhinitis' });
    }
    if (p.firstName === 'Sneha') {
      await complete({ ...ctx, doctor: thakur, offset: -20, rx: RX.sinus, review: [3, 4, 3, 'Good doctor but the wait was long.'], reason: 'Blocked nose' });
      await book({ ...ctx, doctor: gupta, offset: 4, status: 'pending', reason: 'Frequent headaches' });
      await book({ ...ctx, doctor: naik, offset: 6, status: 'confirmed', reason: 'Eye check-up' });
      await book({ ...ctx, doctor: mehta, offset: -2, status: 'cancelled', reason: 'Check-up', paid: false, refunded: true, cancelReason: 'Change of plans' });
    }

    await M.Notification.insertMany([
      { user: patient._id, type: 'registration', title: 'Welcome to CuraLink Health', message: 'Your demo account is ready. You can book doctors, keep records and read health articles.', link: '/pages/patient/dashboard.html' },
      { user: patient._id, type: 'appointment_reminder', title: 'Appointment reminder', message: 'You have an upcoming appointment. Please check the time on your appointments page.', link: '/pages/patient/appointments.html' },
    ]);
    made += 1;
  }

  // requests the admin can work through
  const priya = await M.User.findOne({ email: `priya.deshmukh${DEMO_DOMAIN}` });
  const rohan = await M.User.findOne({ email: `rohan.kulkarni${DEMO_DOMAIN}` });
  if (made && priya && rohan) {
    await M.ContactMessage.insertMany([
      { name: 'Asha Jadhav', email: `asha.jadhav${DEMO_DOMAIN}`, subject: 'Senior citizen package', message: 'Do you offer a discount on the senior citizen package for two people booking together?', status: 'new' },
      { name: 'Kiran More', email: `kiran.more${DEMO_DOMAIN}`, phone: '9200000011', subject: 'Report upload problem', message: 'I could not upload my blood test PDF yesterday. It said the file was too big.', status: 'read' },
      { name: 'Meera Joshi', email: `meera.joshi${DEMO_DOMAIN}`, subject: 'Thank you', message: 'Thank you to the staff at the Gangapur Road branch for a smooth visit.', status: 'resolved' },
    ]);
    await M.EmergencyRequest.insertMany([
      { user: rohan._id, patientName: 'Rohan Kulkarni', phone: '9200000002', pickupLocation: 'Flat 4B, Sunrise Apartments, Kothrud, Pune', emergencyType: 'Accident or injury', patientCount: 1, additionalInfo: 'Demo request. Fictional.', status: 'new' },
      { patientName: 'Demo Caller', phone: '9200000012', pickupLocation: 'College Road, Nashik', emergencyType: 'Breathing difficulty', patientCount: 2, status: 'completed' },
    ]);
    await M.Insurance.insertMany([
      { patient: priya._id, provider: 'Star Health', policyNumber: 'SH-1234-5678', patientIdRef: 'M-889900', status: 'submitted' },
      { patient: rohan._id, provider: 'HDFC ERGO', policyNumber: 'HE-4455-6677', status: 'verified' },
    ]);
    const pkgs = await M.HealthPackage.find({ status: 'active' }).sort({ price: 1 }).limit(2).lean();
    if (pkgs.length) {
      await M.PackageBooking.create({ patient: priya._id, package: pkgs[0]._id, preferredDate: addDays(today, 7), status: 'pending' });
      if (pkgs[1]) await M.PackageBooking.create({ patient: rohan._id, package: pkgs[1]._id, preferredDate: addDays(today, 10), status: 'confirmed' });
    }
  }

  console.log(`\nDone. ${made} demo patient(s) filled in.\n`);
  console.log('Demo logins (all fictional):');
  console.log(`  Patients : ${people.map((x) => x.email).join('\n             ')}\n             password: ${PASSWORD}`);
  console.log('  Doctors  : rahul.sharma@curalink-demo.test (and others), password: Doctor@12345');
  console.log('  Admin    : the ADMIN_EMAIL / ADMIN_PASSWORD from your .env (npm run seed:admin)');
  await mongoose.disconnect();
})().catch(async (e) => { console.error('\nSeeding failed:', e.message); try { await mongoose.disconnect(); } catch (_) { /* ignore */ } process.exit(1); });
