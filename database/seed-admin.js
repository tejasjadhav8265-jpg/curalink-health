// Creates (or updates the password of) the first admin account.
// Usage: set ADMIN_EMAIL / ADMIN_PASSWORD in .env, then run: npm run seed:admin
const mongoose = require('mongoose');
const { mongoUri } = require('../backend/config/env');
const User = require('../backend/models/User');

(async () => {
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in your .env file first.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  const passwordHash = await User.hashPassword(password);

  const admin = await User.findOneAndUpdate(
    { email },
    {
      $set: { passwordHash, role: 'admin', isActive: true },
      $setOnInsert: { firstName: 'System', lastName: 'Admin', phone: '9000000000', email },
    },
    { upsert: true, new: true }
  );
  console.log(`Admin ready: ${admin.email}`);
  await mongoose.disconnect();
})().catch((err) => { console.error(err.message); process.exit(1); });
