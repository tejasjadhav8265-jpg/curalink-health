import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { esc, formatFee, safeImage, setFieldError, setLoading, stateBox } from '../core/ui.js';
import { showToast } from '../core/toast.js';
import { todayIST, addDays, formatDate, to12h } from '../core/dates.js';

const user = await requireRole('patient');
mountLayout({ user, active: 'find-doctor' });

const WINDOW_DAYS = 30; // same as the server's booking window
const params = new URLSearchParams(window.location.search);
const rescheduleId = params.get('reschedule');
const root = document.getElementById('booking');
const sub = document.getElementById('sub');

let doctor;
let current = null;      // the appointment being rescheduled (reschedule mode only)
let selectedTime = '';

async function load() {
  let doctorId = params.get('doctor');
  if (rescheduleId) {
    current = (await api.get(`/appointments/${encodeURIComponent(rescheduleId)}`)).data.appointment;
    doctorId = current.doctor && current.doctor._id;
    document.querySelector('h1').textContent = 'Reschedule appointment';
    sub.textContent = 'Pick a new date and time. Your old slot is released when you confirm.';
    document.title = 'Reschedule appointment | CuraLink Health';
  }
  if (!doctorId) {
    root.innerHTML = stateBox('No doctor selected', 'Please choose a doctor first.', { href: PATHS.findDoctor, label: 'Find a doctor' });
    return;
  }
  doctor = (await api.get(`/doctors/${encodeURIComponent(doctorId)}`)).data.doctor;
  render();
}

function render() {
  const types = doctor.consultationTypes && doctor.consultationTypes.length ? doctor.consultationTypes : ['in-person'];
  const wanted = params.get('type');
  const startType = current ? current.consultationType : (types.includes(wanted) ? wanted : types[0]);
  const today = todayIST();
  const days = doctor.availability && doctor.availability.days && doctor.availability.days.length ? `Works on ${doctor.availability.days.join(', ')}.` : '';

  root.innerHTML = `
  <div class="book-layout">
    <form class="panel" id="book-form" novalidate>
      ${current ? '' : `<fieldset class="field">
        <legend class="form-label">Visit type</legend>
        <div class="type-row">${types.map((t) => `<label class="radio-pill"><input type="radio" name="consultationType" value="${esc(t)}" ${t === startType ? 'checked' : ''}> <span>${t === 'video' ? 'Video consultation' : 'In-person visit'}</span></label>`).join('')}</div>
      </fieldset>`}
      <div class="field">
        <label class="form-label" for="date">Appointment date</label>
        <input class="form-control" type="date" id="date" min="${today}" max="${addDays(today, WINDOW_DAYS)}" required>
        <div class="field-error" id="date-error" hidden></div>
        <p class="slot-hint">You can book up to ${WINDOW_DAYS} days ahead. ${esc(days)}</p>
      </div>
      <div class="field">
        <span class="form-label" id="slots-label">Available times</span>
        <div id="slots" role="group" aria-labelledby="slots-label"><p class="slot-hint">Choose a date to see available times.</p></div>
        <div class="field-error" id="time-error" hidden></div>
      </div>
      <div class="field">
        <label class="form-label" for="reason">${current ? 'Reason for rescheduling (optional)' : 'Reason for visit (optional)'}</label>
        <textarea class="form-control" id="reason" rows="3" maxlength="500" placeholder="${current ? 'For example: I have a work meeting' : 'For example: fever and cough for 3 days'}"></textarea>
      </div>
      <div class="selected-line" id="selected-line" hidden></div>
      <div class="notice notice-error mt-3" id="form-error" role="alert" hidden></div>
      <div class="mt-3 d-flex gap-2 flex-wrap">
        <button class="btn btn-brand" type="submit" id="submit-btn">${current ? 'Confirm new time' : 'Book appointment'}</button>
        <a class="btn btn-ghost" href="${current ? `${PATHS.patient.appointmentDetails}?id=${encodeURIComponent(current._id)}` : PATHS.findDoctor}">Back</a>
      </div>
    </form>

    <aside class="panel book-aside" aria-label="Doctor">
      <div class="book-doc">
        <img src="${esc(safeImage(doctor.profileImage))}" alt="" width="72" height="72">
        <div><strong>${esc(doctor.name)}</strong><br><span class="text-muted">${esc(doctor.specialization)}</span></div>
      </div>
      <ul class="fact-list">
        <li><span>Fee</span><span>${esc(formatFee(doctor.consultationFee))}</span></li>
        <li><span>Location</span><span>${esc(doctor.location)}</span></li>
        ${current ? `<li><span>Current time</span><span>${esc(formatDate(current.appointmentDate))}<br>${esc(to12h(current.slotTime))}</span></li>` : ''}
      </ul>
      <p class="small text-muted mb-0">${current ? 'Appointments can be rescheduled up to 3 times.' : 'Payment is a demo only. No real money is taken.'}</p>
    </aside>
  </div>`;

  const form = document.getElementById('book-form');
  const dateInput = document.getElementById('date');
  dateInput.addEventListener('change', () => loadSlots());
  form.addEventListener('submit', submit);
}

function setSelected(time) {
  selectedTime = time;
  const line = document.getElementById('selected-line');
  const date = document.getElementById('date').value;
  if (time && date) { line.textContent = `Selected: ${formatDate(date)} at ${to12h(time)}`; line.hidden = false; } else { line.hidden = true; }
  document.querySelectorAll('.slot').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.time === time)));
  const err = document.getElementById('time-error'); err.hidden = true;
}

async function loadSlots() {
  const dateInput = document.getElementById('date');
  const box = document.getElementById('slots');
  setFieldError(dateInput, '');
  setSelected('');
  const date = dateInput.value;
  if (!date) { box.innerHTML = '<p class="slot-hint">Choose a date to see available times.</p>'; return; }
  if (date < todayIST() || date > addDays(todayIST(), WINDOW_DAYS)) {
    box.innerHTML = '<p class="slot-hint">Please pick a date within the next 30 days.</p>';
    return;
  }
  box.innerHTML = '<p class="slot-hint">Loading times...</p>';
  try {
    const { slots, message } = (await api.get(`/doctors/${encodeURIComponent(doctor._id)}/slots?date=${encodeURIComponent(date)}`)).data;
    if (!slots.length || message) {
      box.innerHTML = `<p class="slot-hint">${esc(message || 'No times on this date.')}</p>`;
    }
    if (slots.length) {
      box.innerHTML = `<div class="slot-grid">${slots.map((s) => `<button type="button" class="slot" data-time="${esc(s.time)}" aria-pressed="false" ${s.available ? '' : 'disabled'} ${s.available ? '' : `title="${s.reason === 'past' ? 'This time has passed' : 'Already booked'}"`}>${esc(to12h(s.time))}</button>`).join('')}</div>${message ? `<p class="slot-hint">${esc(message)}</p>` : ''}`;
      box.querySelectorAll('.slot:not(:disabled)').forEach((b) => b.addEventListener('click', () => setSelected(b.dataset.time)));
    }
  } catch (error) {
    box.innerHTML = `<p class="slot-hint text-danger">${esc(error.message)}</p>`;
  }
}

async function submit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formError = document.getElementById('form-error');
  const dateInput = document.getElementById('date');
  const timeError = document.getElementById('time-error');
  formError.hidden = true;

  if (!dateInput.value) { setFieldError(dateInput, 'Please select an appointment date.'); dateInput.focus(); return; }
  if (!selectedTime) { timeError.textContent = 'Please select a time slot.'; timeError.hidden = false; return; }

  const button = document.getElementById('submit-btn');
  const reason = document.getElementById('reason').value.trim();
  setLoading(button, true, current ? 'Rescheduling...' : 'Booking...');
  try {
    if (current) {
      await api.put(`/appointments/${encodeURIComponent(current._id)}/reschedule`, { date: dateInput.value, time: selectedTime, reason });
      window.location.href = `${PATHS.patient.appointmentDetails}?id=${encodeURIComponent(current._id)}&rescheduled=1`;
    } else {
      const type = form.elements.consultationType ? form.elements.consultationType.value : 'in-person';
      const res = await api.post('/appointments', { doctorId: doctor._id, date: dateInput.value, time: selectedTime, consultationType: type, reason });
      window.location.href = `${PATHS.patient.bookingConfirmation}?id=${encodeURIComponent(res.data.appointment._id)}`;
    }
  } catch (error) {
    setLoading(button, false);
    if (error.status === 409) { // someone else took the slot first: refresh the list
      showToast(error.message, 'error', 7000);
      await loadSlots();
    } else {
      formError.textContent = (error.errors && error.errors[0] && error.errors[0].message) || error.message;
      formError.hidden = false;
    }
  }
}

try { await load(); } catch (error) {
  root.innerHTML = stateBox(error.status === 404 ? 'Not found' : 'Could not load this page', error.message, { href: PATHS.patient.appointments, label: 'My appointments' });
}
