// Starter data for Phase 3: 10 departments, 20 fictional doctors, and their weekly schedules.
// Safe to run more than once (it updates existing records instead of duplicating them).
// Usage: npm run seed:doctors
// Every doctor also gets a login account so Phase 6 can be tested. Password: SEED_DOCTOR_PASSWORD from .env,
// or the demo default shown at the end. All data is fictional.
const mongoose = require('mongoose');
const { mongoUri } = require('../backend/config/env');
const { Department, Doctor, DoctorAvailability, User } = require('../backend/models');

const DEPARTMENTS = [
  ['Cardiology', 'fa-heart-pulse', 'Heart and blood-vessel care, from check-ups to ongoing treatment.'],
  ['Dermatology', 'fa-hand-dots', 'Skin, hair and nail conditions for all ages.'],
  ['Orthopedics', 'fa-bone', 'Bones, joints, muscles and sports injuries.'],
  ['Pediatrics', 'fa-baby', 'Health care for babies, children and teenagers.'],
  ['Gynecology', 'fa-person-pregnant', "Women's health, pregnancy care and reproductive health."],
  ['Neurology', 'fa-brain', 'Conditions of the brain, spine and nerves.'],
  ['ENT', 'fa-ear-listen', 'Ear, nose and throat problems.'],
  ['Ophthalmology', 'fa-eye', 'Eye examinations, vision problems and eye surgery.'],
  ['Dental Care', 'fa-tooth', 'Dental check-ups, fillings, braces and oral surgery.'],
  ['General Medicine', 'fa-stethoscope', 'First point of contact for fevers, infections and everyday health concerns.'],
];

const D = (name, dept, spec, gender, exp, fee, qual, location, branch, langs, conds, procs, types, rating, count, sched, about) =>
  ({ name, dept, spec, gender, exp, fee, qual, location, branch, langs, conds, procs, types, rating, count, sched, about });

// sched: [weekdays, start, end] windows; weekdays 1=Mon ... 7=Sun
const MF = [1, 2, 3, 4, 5];
const DOCTORS = [
  D('Dr. Rahul Sharma', 'Cardiology', 'Cardiologist', 'male', 18, 900, 'MBBS, MD, DM (Cardiology)', 'Nashik', 'Gangapur Road Branch', ['English', 'Hindi', 'Marathi'], ['Chest pain', 'High blood pressure', 'Heart failure', 'Palpitations'], ['Angiography', 'Echocardiography', 'Pacemaker follow-up'], ['in-person', 'video'], 4.8, 212, [[MF, '09:00', '13:00'], [[2, 4], '16:00', '19:00']], 'Dr. Sharma treats heart conditions with a focus on prevention and long-term follow-up.'),
  D('Dr. Meera Kulkarni', 'Cardiology', 'Interventional Cardiologist', 'female', 12, 800, 'MBBS, MD, DM (Cardiology)', 'Pune', 'Kothrud Branch', ['English', 'Marathi'], ['Coronary artery disease', 'Heart attack recovery'], ['Angioplasty', 'Stress test'], ['in-person'], 4.6, 140, [[[1, 3, 5], '10:00', '14:00']], 'Dr. Kulkarni specialises in opening blocked arteries and helping patients recover after a heart attack.'),
  D('Dr. Priya Patil', 'Dermatology', 'Dermatologist', 'female', 10, 600, 'MBBS, MD (Dermatology)', 'Nashik', 'College Road Branch', ['English', 'Hindi', 'Marathi'], ['Acne', 'Eczema', 'Psoriasis', 'Hair fall'], ['Chemical peel', 'Mole removal', 'Laser hair reduction'], ['in-person', 'video'], 4.7, 189, [[MF, '11:00', '15:00'], [[6], '10:00', '13:00']], 'Dr. Patil treats skin and hair concerns and explains each treatment plan in plain language.'),
  D('Dr. Sanjay Jadhav', 'Dermatology', 'Cosmetic Dermatologist', 'male', 8, 700, 'MBBS, DDVL', 'Mumbai', 'Andheri Branch', ['English', 'Hindi'], ['Pigmentation', 'Skin allergies', 'Scars'], ['Laser treatments', 'Skin biopsy'], ['in-person'], 4.4, 96, [[[2, 4, 6], '12:00', '18:00']], 'Dr. Jadhav focuses on pigmentation, scars and everyday skin care.'),
  D('Dr. Amit Deshmukh', 'Orthopedics', 'Orthopedic Surgeon', 'male', 20, 850, 'MBBS, MS (Orthopedics)', 'Nashik', 'Gangapur Road Branch', ['English', 'Hindi', 'Marathi'], ['Knee pain', 'Fractures', 'Arthritis', 'Back pain'], ['Knee replacement', 'Arthroscopy', 'Fracture fixation'], ['in-person'], 4.9, 301, [[[1, 2, 4, 5], '09:30', '13:30']], 'Dr. Deshmukh has two decades of experience in joint replacement and fracture care.'),
  D('Dr. Neha Joshi', 'Orthopedics', 'Sports Medicine Specialist', 'female', 9, 750, 'MBBS, MS (Orthopedics), Fellowship in Sports Medicine', 'Pune', 'Baner Branch', ['English', 'Hindi', 'Marathi'], ['Sports injuries', 'Ligament tears', 'Shoulder pain'], ['ACL reconstruction', 'Physiotherapy planning'], ['in-person', 'video'], 4.5, 120, [[MF, '15:00', '19:00']], 'Dr. Joshi helps athletes and active people recover from injuries and return to play.'),
  D('Dr. Kavita Rao', 'Pediatrics', 'Pediatrician', 'female', 14, 500, 'MBBS, MD (Pediatrics)', 'Nashik', 'College Road Branch', ['English', 'Hindi', 'Marathi', 'Kannada'], ['Fever in children', 'Childhood infections', 'Growth concerns', 'Vaccinations'], ['Vaccination', 'Newborn check-up'], ['in-person', 'video'], 4.8, 255, [[MF, '10:00', '14:00'], [[6], '10:00', '12:00']], 'Dr. Rao looks after children from birth to 18 and supports parents with clear guidance.'),
  D('Dr. Vikram Pawar', 'Pediatrics', 'Pediatric Neurologist', 'male', 11, 700, 'MBBS, MD (Pediatrics), DM (Neurology)', 'Mumbai', 'Andheri Branch', ['English', 'Hindi', 'Marathi'], ['Seizures in children', 'Developmental delay', 'Headaches in children'], ['EEG review'], ['video'], 4.6, 88, [[[1, 3], '14:00', '18:00']], 'Dr. Pawar cares for children with seizures, headaches and developmental concerns.'),
  D('Dr. Anjali Mehta', 'Gynecology', 'Gynecologist and Obstetrician', 'female', 16, 750, 'MBBS, MS (Obstetrics and Gynaecology)', 'Nashik', 'Gangapur Road Branch', ['English', 'Hindi', 'Gujarati', 'Marathi'], ['Pregnancy care', 'PCOS', 'Menstrual problems', 'Infertility'], ['Normal and caesarean delivery', 'Ultrasound', 'Fertility counselling'], ['in-person', 'video'], 4.9, 330, [[MF, '10:00', '14:00']], 'Dr. Mehta provides care through pregnancy and supports women with menstrual and hormonal concerns.'),
  D('Dr. Sunita Bhosale', 'Gynecology', 'Gynecologist', 'female', 7, 600, 'MBBS, DGO', 'Pune', 'Kothrud Branch', ['English', 'Marathi'], ['Menopause', 'Fibroids', 'Routine check-ups'], ['Pap smear', 'Contraception counselling'], ['in-person'], 4.3, 74, [[[2, 4, 6], '09:00', '13:00']], 'Dr. Bhosale offers routine women\'s health check-ups and menopause care.'),
  D('Dr. Rajesh Nair', 'Neurology', 'Neurologist', 'male', 22, 1000, 'MBBS, MD, DM (Neurology)', 'Mumbai', 'Andheri Branch', ['English', 'Hindi', 'Malayalam'], ['Migraine', 'Epilepsy', 'Stroke recovery', 'Parkinson\'s disease'], ['EEG', 'Nerve conduction study'], ['in-person', 'video'], 4.7, 198, [[[1, 2, 3], '11:00', '15:00']], 'Dr. Nair treats conditions of the brain and nerves, with special interest in migraine and epilepsy.'),
  D('Dr. Ishita Gupta', 'Neurology', 'Neurologist', 'female', 9, 800, 'MBBS, MD, DM (Neurology)', 'Nashik', 'College Road Branch', ['English', 'Hindi'], ['Headache', 'Dizziness', 'Memory problems', 'Neuropathy'], ['EEG review', 'Botulinum treatment for migraine'], ['in-person', 'video'], 4.5, 112, [[[2, 4, 5], '15:00', '19:00']], 'Dr. Gupta evaluates headaches, dizziness and memory concerns.'),
  D('Dr. Manoj Thakur', 'ENT', 'ENT Surgeon', 'male', 15, 600, 'MBBS, MS (ENT)', 'Nashik', 'Gangapur Road Branch', ['English', 'Hindi', 'Marathi'], ['Sinusitis', 'Hearing loss', 'Tonsillitis', 'Vertigo'], ['Tonsillectomy', 'Sinus surgery', 'Hearing tests'], ['in-person'], 4.6, 167, [[MF, '16:00', '20:00']], 'Dr. Thakur treats ear, nose and throat problems in adults and children.'),
  D('Dr. Pooja Iyer', 'ENT', 'ENT Specialist', 'female', 6, 500, 'MBBS, DNB (ENT)', 'Pune', 'Baner Branch', ['English', 'Tamil', 'Hindi'], ['Allergic rhinitis', 'Voice problems', 'Ear infections'], ['Endoscopy', 'Ear wax removal'], ['in-person', 'video'], 4.4, 63, [[[1, 3, 5], '10:00', '14:00']], 'Dr. Iyer helps with allergies, voice problems and ear infections.'),
  D('Dr. Suresh Naik', 'Ophthalmology', 'Eye Surgeon', 'male', 19, 700, 'MBBS, MS (Ophthalmology)', 'Nashik', 'College Road Branch', ['English', 'Hindi', 'Marathi'], ['Cataract', 'Glaucoma', 'Diabetic eye disease', 'Refractive errors'], ['Cataract surgery', 'LASIK counselling', 'Retina screening'], ['in-person'], 4.8, 241, [[[1, 2, 3, 4, 6], '09:00', '13:00']], 'Dr. Naik performs cataract surgery and manages glaucoma and diabetic eye disease.'),
  D('Dr. Farah Khan', 'Ophthalmology', 'Ophthalmologist', 'female', 8, 600, 'MBBS, DNB (Ophthalmology)', 'Mumbai', 'Andheri Branch', ['English', 'Hindi', 'Urdu'], ['Dry eyes', 'Squint', 'Contact lens problems'], ['Eye examination', 'Squint assessment'], ['in-person', 'video'], 4.5, 91, [[[2, 4, 5], '13:00', '17:00']], 'Dr. Khan manages dry eyes, squint and contact lens issues.'),
  D('Dr. Aditya Shah', 'Dental Care', 'Dentist', 'male', 12, 400, 'BDS, MDS (Conservative Dentistry)', 'Nashik', 'College Road Branch', ['English', 'Hindi', 'Gujarati', 'Marathi'], ['Toothache', 'Cavities', 'Gum disease', 'Sensitive teeth'], ['Root canal', 'Fillings', 'Teeth cleaning'], ['in-person'], 4.7, 276, [[MF, '10:00', '19:00']], 'Dr. Shah provides check-ups, fillings and root canal treatment.'),
  D('Dr. Rutuja Salunkhe', 'Dental Care', 'Orthodontist', 'female', 7, 500, 'BDS, MDS (Orthodontics)', 'Pune', 'Kothrud Branch', ['English', 'Marathi', 'Hindi'], ['Crooked teeth', 'Bite problems'], ['Braces', 'Clear aligners'], ['in-person', 'video'], 4.6, 82, [[[3, 5, 6], '11:00', '18:00']], 'Dr. Salunkhe straightens teeth with braces and clear aligners.'),
  D('Dr. Harish Menon', 'General Medicine', 'General Physician', 'male', 25, 400, 'MBBS, MD (Internal Medicine)', 'Nashik', 'Gangapur Road Branch', ['English', 'Hindi', 'Marathi', 'Malayalam'], ['Fever', 'Diabetes', 'Thyroid problems', 'Infections', 'High blood pressure'], ['Health check-ups', 'Diabetes management'], ['in-person', 'video'], 4.8, 410, [[MF, '09:00', '13:00'], [MF, '17:00', '20:00'], [[6], '09:00', '13:00']], 'Dr. Menon has 25 years of experience in everyday medicine and long-term conditions like diabetes.'),
  D('Dr. Swati Kamat', 'General Medicine', 'Family Physician', 'female', 11, 350, 'MBBS, DNB (Family Medicine)', 'Mumbai', 'Andheri Branch', ['English', 'Hindi', 'Marathi', 'Konkani'], ['Cold and flu', 'Stomach upset', 'Joint pain', 'Fatigue'], ['Health check-ups', 'Vaccinations for adults'], ['in-person', 'video'], 4.5, 150, [[MF, '10:00', '16:00']], 'Dr. Kamat looks after the whole family and coordinates care with specialists when needed.'),
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const slug = (s) => s.toLowerCase().replace(/^dr\.\s*/, '').replace(/[^a-z0-9]+/g, '.').replace(/(^\.|\.$)/g, '');

(async () => {
  await mongoose.connect(mongoUri);
  const password = process.env.SEED_DOCTOR_PASSWORD || 'Doctor@12345';
  const passwordHash = await User.hashPassword(password);

  const deptIds = {};
  for (const [name, icon, description] of DEPARTMENTS) {
    const dept = await Department.findOneAndUpdate(
      { name }, { $set: { icon, description, status: 'active' }, $setOnInsert: { name } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (!dept.slug) { dept.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); await dept.save(); }
    deptIds[name] = dept._id;
  }

  let n = 0;
  for (const d of DOCTORS) {
    n += 1;
    const email = `${slug(d.name)}@curalink-demo.test`;
    const [first, ...rest] = d.name.replace(/^Dr\.\s*/, '').split(' ');
    const user = await User.findOneAndUpdate(
      { email },
      { $set: { role: 'doctor', isActive: true }, $setOnInsert: { firstName: first, lastName: rest.join(' '), email, phone: String(9100000000 + n), passwordHash, gender: d.gender, city: d.location } },
      { upsert: true, new: true }
    );
    const doctor = await Doctor.findOneAndUpdate(
      { registrationNumber: `MMC-${20000 + n}` },
      {
        $set: {
          user: user._id, name: d.name, email, phone: String(9100000000 + n), specialization: d.spec, department: deptIds[d.dept],
          qualification: d.qual, experience: d.exp, gender: d.gender, languages: d.langs, location: d.location, branch: d.branch,
          consultationFee: d.fee, about: d.about, conditionsTreated: d.conds, procedures: d.procs, consultationTypes: d.types,
          ratingAvg: d.rating, ratingCount: d.count, status: 'active',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const weekly = Object.fromEntries(DAYS.map((day) => [day, []]));
    d.sched.forEach(([days, start, end]) => days.forEach((n1) => weekly[DAYS[n1 - 1]].push({ start, end })));
    await DoctorAvailability.findOneAndUpdate(
      { doctor: doctor._id }, { $set: { weekly, slotDuration: 30, blockedDates: [] } }, { upsert: true, setDefaultsOnInsert: true }
    );
  }

  console.log(`Seeded ${DEPARTMENTS.length} departments and ${DOCTORS.length} doctors with schedules.`);
  console.log(`Doctor logins: <name>@curalink-demo.test, e.g. ${slug(DOCTORS[0].name)}@curalink-demo.test`);
  console.log(`Doctor password: ${password}`);
  await mongoose.disconnect();
})().catch((err) => { console.error(err.message); process.exit(1); });
