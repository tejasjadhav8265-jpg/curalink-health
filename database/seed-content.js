// Adds demo health packages and health articles. Safe to run more than once (it skips ones that already exist).
// Usage:  node database/seed-content.js
// Everything here is fictional demo content for learning. It is not medical advice.
const mongoose = require('mongoose');
const { mongoUri } = require('../backend/config/env');
const { HealthPackage, Article } = require('../backend/models');

const PACKAGES = [
  { name: 'Basic Health Check', price: 999, duration: '1-2 hours', description: 'A simple yearly check for healthy adults.', tests: ['Complete blood count', 'Blood sugar (fasting)', 'Lipid profile', 'Urine routine', 'Doctor consultation'] },
  { name: 'Diabetes Care Package', price: 1499, duration: '2 hours', description: 'Tests that help track blood sugar over time.', tests: ['Blood sugar (fasting and after food)', 'HbA1c', 'Kidney function', 'Urine albumin', 'Diet consultation'] },
  { name: 'Heart Health Package', price: 2999, duration: '3 hours', description: 'A closer look at heart health for people over 35.', tests: ['ECG', 'Lipid profile', 'Blood pressure review', 'Blood sugar (fasting)', 'Cardiologist consultation'] },
  { name: "Women's Wellness Package", price: 2499, duration: '3 hours', description: 'Routine checks for women, with a gynaecologist visit.', tests: ['Complete blood count', 'Thyroid profile', 'Vitamin D and B12', 'Breast examination', 'Gynaecologist consultation'] },
  { name: 'Senior Citizen Package', price: 3999, duration: '4 hours', description: 'A complete check for people over 60.', tests: ['Complete blood count', 'Lipid profile', 'Kidney and liver function', 'ECG', 'Eye and hearing screening', 'Physician consultation'] },
];

const BY = 'CuraLink Editorial Team';
const ARTICLES = [
  { title: 'Keeping your blood pressure in check', category: 'Cardiology', content: 'High blood pressure often has no symptoms, so the only way to know is to measure it. Adults should have it checked at least once a year, and more often if a doctor has advised.\n\nSmall habits help: eat less salt, stay active for about 30 minutes most days, keep a healthy weight, and limit alcohol. If you have been given medicine, take it every day even when you feel well.\n\nSee a doctor if your readings stay high on several days, or if you get a severe headache, chest pain or breathlessness.' },
  { title: 'Living well with diabetes: five everyday habits', category: 'Diabetes', content: 'Diabetes care works best when it is part of daily life.\n\nCheck your sugar as often as your doctor suggests and write the numbers down. Eat regular meals with plenty of vegetables, and choose whole grains over refined ones. Walk after meals when you can. Look at your feet every day for cuts or sores. Keep your yearly eye and kidney checks.\n\nYour doctor can set targets that suit you. Do not change your medicines without asking.' },
  { title: 'A simple plate: how to eat balanced meals', category: 'Nutrition', content: 'Think of your plate in parts. Fill about half with vegetables and fruit, a quarter with whole grains such as roti, brown rice or millets, and a quarter with protein such as dal, eggs, paneer, fish or chicken.\n\nDrink water through the day. Keep fried snacks and sweet drinks for occasional treats. Eating at regular times helps energy and mood.\n\nIf you have a health condition or allergy, ask your doctor or a dietitian for a plan made for you.' },
  { title: 'Looking after yourself during pregnancy', category: "Women's Health", content: 'Regular antenatal check-ups are the most important part of a healthy pregnancy. Go to every visit, even when you feel well.\n\nTake the iron and folic acid your doctor prescribes, eat a varied diet, rest well and stay gently active. Avoid smoking, alcohol and any medicine that has not been approved by your doctor.\n\nCall your doctor or go to a hospital straight away if you have heavy bleeding, severe stomach pain, a bad headache with blurred vision, or if the baby moves much less than usual.' },
  { title: 'Fevers in children: what parents can do at home', category: "Children's Health", content: 'Fever is the body fighting an infection and is common in children. Keep your child comfortable in light clothes, offer plenty of fluids and let them rest.\n\nUse only the medicine and dose your child\'s doctor or the label recommends for their age and weight.\n\nSee a doctor quickly if the child is under 3 months old, the fever lasts more than 3 days, or there is trouble breathing, a stiff neck, a rash that does not fade, constant vomiting, or the child is very sleepy or hard to wake.' },
  { title: 'Protecting your knees and back', category: 'Orthopedics', content: 'Strong muscles protect your joints. Walking, swimming and cycling are gentle on the knees. Add simple stretches and strengthening exercises for your legs, core and back.\n\nSit with your back supported, stand up and move every hour, lift heavy things by bending your knees, and keep a healthy weight to reduce the load on your joints.\n\nSee an orthopaedic doctor if pain lasts more than two weeks, if a joint swells, or if you have numbness or weakness in a leg.' },
  { title: 'Sun, skin and sensible sunscreen', category: 'Skin Care', content: 'Strong sun can damage skin even on cloudy days. Use a broad-spectrum sunscreen with SPF 30 or higher on the face, neck and arms, and put it on again every two to three hours outdoors.\n\nA hat, sunglasses and light full-sleeve clothes help too. Try to avoid the harshest sun between late morning and mid-afternoon.\n\nShow a skin doctor any mole that changes in size, shape or colour, or any sore that does not heal.' },
  { title: 'Getting started with exercise, gently', category: 'Fitness', content: 'You do not need a gym. Aim for about 150 minutes of moderate activity each week, such as brisk walking, and add two short strength sessions.\n\nStart with 10 minutes a day and add a little each week. Warm up first, drink water, and stop if you feel chest pain, severe breathlessness or dizziness.\n\nIf you have a heart condition, diabetes, high blood pressure or are over 40 and have been inactive, ask your doctor before you begin.' },
  { title: 'Sleep: why it matters and how to get more of it', category: 'General Health', content: 'Most adults need 7 to 9 hours of sleep. Good sleep supports memory, mood, immunity and heart health.\n\nGo to bed and wake up at the same times, keep the room dark and cool, and put screens away for an hour before bed. Avoid tea, coffee and large meals late in the evening.\n\nTalk to a doctor if you snore loudly, stop breathing in your sleep, or feel very tired in the day even after a full night in bed.' },
];

(async () => {
  await mongoose.connect(mongoUri);
  let p = 0; let a = 0;
  for (const pkg of PACKAGES) { if (!(await HealthPackage.exists({ name: pkg.name }))) { await HealthPackage.create(pkg); p += 1; } }
  for (const art of ARTICLES) {
    const slug = art.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!(await Article.exists({ slug }))) { await Article.create({ ...art, slug, author: BY, status: 'published' }); a += 1; }
  }
  console.log(`Added ${p} health packages and ${a} articles (existing ones were left alone).`);
  await mongoose.disconnect();
})().catch((e) => { console.error('Seeding failed:', e.message); process.exit(1); });
