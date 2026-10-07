# CuraLink Health: Doctor and Medical Appointment Management System

A full-stack demo hospital website: patients find doctors and book visits, doctors run their day, and admins manage the hospital.
Built with Node.js, Express, MongoDB (Mongoose), Bootstrap 5 and plain JavaScript.

> **This is a demonstration and learning project. It is not a real medical service.**
> Payments are demo only (no money moves), the ambulance and video room are simulated, and all people, doctors and reviews are fictional.

## What you need
- Node.js 18 or newer
- MongoDB running on your computer, or a free MongoDB Atlas connection string

## First-time setup (Windows PowerShell, inside this folder)
```
npm install
copy .env.example .env
```
Open `.env` in VS Code and change `JWT_SECRET` (and `MONGO_URI` if you use Atlas). Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` too.

Then fill the database with demo data and start the server:
```
npm run seed:admin
npm run seed
npm run dev
```
Open http://localhost:5000

`npm run seed` adds departments, 20 doctors, health packages, articles, and three demo patients with appointments in every status, prescriptions, reviews and requests.
Run `npm run seed -- --reset` to rebuild the demo patients' history so the dates are fresh (do this if the demo dates look old).

## Demo logins
| Role | Email | Password |
|---|---|---|
| Admin | the `ADMIN_EMAIL` in your `.env` | the `ADMIN_PASSWORD` in your `.env` |
| Doctor | `rahul.sharma@curalink-demo.test` (every doctor is `first.last@curalink-demo.test`) | `Doctor@12345` |
| Patient | `priya.deshmukh@curalink-demo.test`, `rohan.kulkarni@curalink-demo.test`, `sneha.patil@curalink-demo.test` | `Patient@12345` |

## Handy commands
| Command | What it does |
|---|---|
| `npm run dev` | Starts the server and restarts it when you change a file |
| `npm start` | Starts the server once (for production) |
| `npm run seed` | Everything in one go (safe to repeat) |
| `npm run seed:admin` | Creates or updates the admin account |
| `npm run seed:doctors` | Departments and doctors only |
| `npm run seed:content` | Health packages and articles only |

## Folders
- `backend/` the API: config, models, routes, controllers, validators, middleware, services
- `frontend/` the pages (HTML, CSS and JavaScript) that Express serves
- `database/` the seed scripts
- `uploads/reports/` patients' uploaded reports (private, never served directly)

## What is built
- **Public:** home, find a doctor, departments, doctor profiles, booking, articles, "which doctor do I need?", health packages, insurance, teleconsultation info, emergency numbers, ambulance request (demo), FAQ, contact, privacy, terms, disclaimer.
- **Patients:** appointments (book, reschedule, cancel), token queue, demo payments, medical record, report uploads, prescriptions (PDF), reviews, notifications, package and insurance requests, demo video room.
- **Doctors:** dashboard, today's queue, appointment actions, availability and blocked dates, patient list and records (only with a confirmed or completed visit), consultation notes, prescriptions, video room.
- **Admins:** dashboard, doctors, patients, departments, appointments, analytics charts, requests inbox, audit logs.

## Safety and privacy choices
- Login uses a signed cookie that scripts cannot read. Passwords are stored only as one-way hashes.
- The server checks the role on every request, not just the page.
- Double-booking is stopped by the database itself: one active booking per doctor, date and time.
- Doctors see a patient's health record only with a confirmed or completed appointment, and each view is logged. Admins cannot open records.
- Reports are stored outside the web folder with random names and are downloadable only by the owner or an allowed doctor.
- Inputs are validated, cleaned and rate-limited. Pages use a strict content security policy.

## Troubleshooting
- **"Missing required environment variables"**: you have not created `.env` yet. Run `copy .env.example .env` and edit it.
- **"Failed to start server" or Mongo errors**: MongoDB is not running, or `MONGO_URI` is wrong.
- **Port already in use**: another copy of the server is running. Press Ctrl+C in its terminal, or change `PORT` in `.env`.
- **A page shows 404**: the file is missing. Check that you extracted any update zip from inside this folder.
- **Demo appointments look old**: run `npm run seed -- --reset`.

## Testing and security

- `npm test` - quick rule tests (no database needed)
- `npm run smoke` - live check of a running server (see SECURITY.md)
- `SECURITY.md` - what is protected and what to do before real use
