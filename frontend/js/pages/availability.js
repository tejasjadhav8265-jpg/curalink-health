import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { mountLayout } from '../components/layout.js';
import { esc, setLoading, showNotice, stateBox } from '../core/ui.js';
import { showToast } from '../core/toast.js';
import { todayIST, addDays, formatDate } from '../core/dates.js';

const user = await requireRole('doctor');
mountLayout({ user, active: 'availability' });

const root = document.getElementById('editor');
const DAYS = [['monday', 'Monday'], ['tuesday', 'Tuesday'], ['wednesday', 'Wednesday'], ['thursday', 'Thursday'], ['friday', 'Friday'], ['saturday', 'Saturday'], ['sunday', 'Sunday']];
const DURATIONS = [10, 15, 20, 30, 45, 60];

let state; // { slotDuration, weekly, blockedDates }

function applyServer(data) {
  state = { slotDuration: data.slotDuration, weekly: data.weekly, blockedDates: data.blockedDates };
}

function render() {
  root.innerHTML = `
  <div id="msg" aria-live="polite"></div>
  <div class="details-grid">
    <section class="panel">
      <h2 class="h5">Weekly hours</h2>
      <p class="text-muted small">Patients can only book inside these hours. You can add up to 4 time ranges per day.</p>
      ${DAYS.map(([key, label]) => `<div class="day-row" data-day="${key}">
        <div class="day-name">${label}</div>
        <div>
          ${state.weekly[key].length ? state.weekly[key].map((w, i) => `<div class="win-row">
            <input class="form-control" type="time" value="${esc(w.start)}" data-day="${key}" data-i="${i}" data-field="start" aria-label="${label} start time ${i + 1}">
            <span aria-hidden="true">to</span>
            <input class="form-control" type="time" value="${esc(w.end)}" data-day="${key}" data-i="${i}" data-field="end" aria-label="${label} end time ${i + 1}">
            <button type="button" class="btn btn-ghost btn-sm-brand" data-remove="${key}" data-i="${i}" aria-label="Remove ${label} hours ${i + 1}">Remove</button>
          </div>`).join('') : '<span class="closed-text">Closed</span>'}
          ${state.weekly[key].length < 4 ? `<button type="button" class="btn btn-ghost btn-sm-brand" data-add="${key}">Add hours</button>` : ''}
          ${key === 'monday' ? '<button type="button" class="btn btn-ghost btn-sm-brand ms-1" id="copy-mon">Copy Monday to Tue-Fri</button>' : ''}
        </div>
      </div>`).join('')}
    </section>
    <div>
      <section class="panel">
        <h2 class="h5">Visit length</h2>
        <label class="form-label" for="duration">Minutes per patient</label>
        <select class="form-select" id="duration">${DURATIONS.map((d) => `<option value="${d}" ${d === state.slotDuration ? 'selected' : ''}>${d} minutes</option>`).join('')}</select>
        <button type="button" class="btn btn-brand w-100 mt-3" id="save-btn">Save timings</button>
      </section>
      <section class="panel">
        <h2 class="h5">Days off</h2>
        <p class="text-muted small">Block a date when you are on leave. Patients cannot book blocked dates.</p>
        <label class="form-label" for="block-date">Date</label>
        <div class="d-flex gap-2"><input class="form-control" type="date" id="block-date" min="${todayIST()}" max="${addDays(todayIST(), 365)}"><button type="button" class="btn btn-ghost" id="block-btn">Block</button></div>
        <ul class="blocked-list" aria-label="Blocked dates">${state.blockedDates.length ? state.blockedDates.map((d) => `<li>${esc(formatDate(d))}<button type="button" data-unblock="${esc(d)}" aria-label="Unblock ${esc(d)}">&times;</button></li>`).join('') : '<li class="bg-transparent text-muted fw-normal p-0">No blocked dates</li>'}</ul>
      </section>
    </div>
  </div>`;
  bind();
}

function bind() {
  root.querySelectorAll('input[data-field]').forEach((input) => input.addEventListener('input', () => {
    state.weekly[input.dataset.day][Number(input.dataset.i)][input.dataset.field] = input.value;
  }));
  root.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
    const list = state.weekly[b.dataset.add];
    const last = list[list.length - 1];
    list.push(last ? { start: last.end, end: last.end } : { start: '09:00', end: '13:00' });
    render();
  }));
  root.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
    state.weekly[b.dataset.remove].splice(Number(b.dataset.i), 1);
    render();
  }));
  document.getElementById('copy-mon')?.addEventListener('click', () => {
    ['tuesday', 'wednesday', 'thursday', 'friday'].forEach((d) => { state.weekly[d] = state.weekly.monday.map((w) => ({ ...w })); });
    render();
    showToast('Copied. Remember to save.', 'info');
  });
  document.getElementById('duration').addEventListener('change', (e) => { state.slotDuration = Number(e.target.value); });
  document.getElementById('save-btn').addEventListener('click', save);
  document.getElementById('block-btn').addEventListener('click', blockDate);
  root.querySelectorAll('[data-unblock]').forEach((b) => b.addEventListener('click', () => unblock(b.dataset.unblock)));
}

const msg = () => document.getElementById('msg');
const serverText = (error) => (error.errors && error.errors[0] && error.errors[0].message) || error.message;

async function save() {
  const button = document.getElementById('save-btn');
  setLoading(button, true, 'Saving...');
  try {
    const res = await api.put('/availability', { slotDuration: state.slotDuration, weekly: state.weekly });
    applyServer(res.data);
    render();
    showNotice(msg(), res.data.warning || 'Your timings were saved.', res.data.warning ? 'info' : 'success');
  } catch (error) {
    setLoading(button, false);
    showNotice(msg(), serverText(error), 'error');
    msg().scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

async function blockDate() {
  const input = document.getElementById('block-date');
  if (!input.value) { showNotice(msg(), 'Please choose a date to block.', 'error'); return; }
  try {
    const res = await api.post('/availability/block-date', { date: input.value });
    const edited = state.weekly; // keep any unsaved hour edits
    applyServer(res.data);
    state.weekly = edited;
    render();
    showNotice(msg(), res.data.warning || res.message, res.data.warning ? 'info' : 'success');
  } catch (error) { showNotice(msg(), serverText(error), 'error'); }
}

async function unblock(date) {
  try {
    const res = await api.del(`/availability/block-date/${encodeURIComponent(date)}`);
    const edited = state.weekly;
    applyServer(res.data);
    state.weekly = edited;
    render();
    showNotice(msg(), res.message, 'success');
  } catch (error) { showNotice(msg(), serverText(error), 'error'); }
}

try {
  applyServer((await api.get('/availability')).data);
  render();
} catch (error) {
  root.innerHTML = stateBox('Could not load your availability', error.message);
}
