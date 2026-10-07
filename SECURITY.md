# Security and testing notes

CuraLink Health is a **demo / learning project**. Payments, ambulance, insurance and video calls are simulated. Read the "Before real use" list before putting it on the internet.

## What is protected

| Area | How |
|---|---|
| Passwords | Hashed with bcrypt (12 rounds). Never returned by the API. Strong-password rules on sign-up and change. |
| Login | httpOnly + SameSite cookie (Secure in production). Same error for "wrong password" and "unknown email". Login is rate-limited. |
| Sessions | A password change signs out every other device (`tokenVersion`). Deactivated users are blocked on their next request. |
| Roles | Every `/api/admin`, `/api/doctor` and patient route checks the role on the server. Hiding a menu item is never the only protection. |
| Ownership | Patients only see their own appointments, reports, prescriptions and records. Doctors see a patient only with a confirmed/completed appointment, and each view is audit-logged. Admins cannot open medical records. |
| Double booking | A unique database index plus a check in the code. Two people booking the same slot: one succeeds, the other gets a clear "slot taken" message. |
| Input | Every route validates its input. Text is cleaned (xss), and MongoDB operators (`$gt`...) are stripped. Fields are picked one by one, so nobody can send `role: admin`. |
| Pages | Content-Security-Policy (no inline scripts), all user text is escaped before it is shown, and the login `next=` link only accepts our own pages. |
| Uploads | Reports are stored outside the web folder under random names. Only PDF/JPG/PNG, checked by type **and** by the file's first bytes, 5 MB max. |
| Forms | Contact and ambulance forms have a stricter rate limit. |
| Secrets | `.env` is git-ignored. In production the app refuses to start if `JWT_SECRET` is shorter than 32 characters. |

## Fixed in Phase 10

1. Old sessions kept working after a password change. They are now refused.
2. A weak `JWT_SECRET` was accepted in production. It is now rejected.
3. Notification links are only followed if they are pages on this website.
4. `TRUST_PROXY` option, so rate limits count real visitors when the site sits behind a hosting proxy.

## Running the checks

- `npm test` runs the rule tests (dates, slots, appointment flow, analytics, symptom finder). No database needed.
- `npm run smoke` checks a **running** server (run `npm run seed` and `npm run dev` first, then open a second PowerShell window). It tests: logged-out and wrong-role access, login behaviour, cookie flags, validation, script tags in forms, the double-booking race, and sign-out on password change. It creates a few `smoke...@curalink-demo.test` patients. Add `SMOKE_DOCTOR_EMAIL` to also test doctor privacy.

## Before real use (not done on purpose)

- Real medical data needs legal review (India's DPDP Act, hospital policies) and a proper audit.
- Serve over HTTPS only and set `NODE_ENV=production`.
- Logging out clears the cookie on that device but does not cancel the token itself (it still expires after 1 day). Changing the password cancels all tokens.
- Insurance policy numbers are stored as plain text (masked when shown). Encrypt them before real use.
- No email verification, password reset by email, or two-step login.
- Uploaded reports are not virus-scanned.
- Payments, ambulance requests and video calls are simulations.
- Add database backups and monitoring.
