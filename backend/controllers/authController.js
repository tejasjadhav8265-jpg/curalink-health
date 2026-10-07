const bcrypt = require('bcryptjs');
const User = require('../models/User');
const PatientRecord = require('../models/PatientRecord');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { DASHBOARD_PATHS } = require('../utils/constants');
const { signToken, setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const { audit } = require('../services/auditService');
const { notify } = require('../services/notificationService');

// Compared against when the email is unknown, so "no such user" and "wrong password"
// take about the same time (prevents guessing which emails are registered).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

// The only user fields the browser ever receives.
const publicUser = (user) => ({
  id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  fullName: `${user.firstName} ${user.lastName}`,
  email: user.email,
  role: user.role,
});

// POST /api/auth/register  (public: creates PATIENT accounts only)
const register = asyncHandler(async (req, res) => {
  // Pick fields explicitly: a client can never choose its own role.
  const { firstName, lastName, email, phone, dob, gender, address, city, state, emergencyContact, password } = req.body;

  const existing = await User.findOne({ $or: [{ email }, { phone }] }).select('email phone');
  if (existing) {
    throw ApiError.conflict(
      existing.email === email
        ? 'An account with this email already exists.'
        : 'An account with this mobile number already exists.'
    );
  }

  const passwordHash = await User.hashPassword(password); // never store the plain password
  const user = await User.create({
    firstName, lastName, email, phone, passwordHash, gender, city, state,
    dob: new Date(dob),
    address: address || undefined,
    emergencyContact: emergencyContact || undefined,
    role: 'patient',
  });

  await PatientRecord.create({ patient: user._id }); // empty medical record, filled in over time

  await notify(user._id, {
    type: 'registration',
    title: 'Welcome to CuraLink Health',
    message: 'Your account is ready. You can now find doctors and book appointments.',
    link: DASHBOARD_PATHS.patient,
  });
  await audit({
    req, user: user._id, action: 'USER_REGISTERED', entity: 'User', entityId: user._id,
    description: `New patient registered: ${user.email}`,
  });

  res.status(201).json({ success: true, message: 'Registration successful. Please log in.' });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordMatches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !passwordMatches) throw new ApiError(401, 'Invalid email or password.');
  if (!user.isActive) throw ApiError.forbidden('Your account has been deactivated. Please contact support.');

  setAuthCookie(res, signToken(user));
  res.json({
    success: true,
    message: 'Login successful.',
    data: { user: publicUser(user), redirectTo: DASHBOARD_PATHS[user.role] },
  });
});

// POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'You have been logged out.' });
});

// GET /api/auth/me  (requires login) - used by every page to know who is signed in
const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: publicUser(req.user), dashboard: DASHBOARD_PATHS[req.user.role] } });
});

module.exports = { register, login, logout, me };
