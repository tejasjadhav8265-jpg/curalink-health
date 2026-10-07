import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { confirmModal } from '../components/confirm-modal.js';
import { esc, stateBox, setLoading } from '../core/ui.js';
import { showToast } from '../core/toast.js';
import { formatDate, to12h } from '../core/dates.js';

// A SIMULATED consultation room: text chat only. Patient and doctor both open this page.
const user = await requireRole('patient', 'doctor');
mountLayout({ user, active: user.role === 'doctor' ? 'appointments' : 'appointments' });
const root = document.getElementById('root');
const id = new URLSearchParams(window.location.search).get('id');
const back = user.role === 'doctor' ? PATHS.doctor.appointments : PATHS.patient.appointments;
let timer;
let lastCount = -1;

if (!id) {
  root.innerHTML = stateBox('No appointment selected', 'Open the video room from your appointment.', { href: back, label: 'My appointments' });
} else {
  await refresh(true);
}

async function refresh(first = false) {
  let d;
  try { d = (await api.get(`/teleconsultations/${encodeURIComponent(id)}`)).data; }
  catch (error) { clearTimeout(timer); root.innerHTML = stateBox(error.status === 404 ? 'Room not found' : 'Could not open the room', error.message, { href: back, label: 'Back to appointments' }); return; }
  const s = d.session;
  const isDoctor = d.role === 'doctor';
  const other = isDoctor ? d.appointment.patient : d.appointment.doctor;
  const live = s && s.status === 'in-progress';

  if (first || !root.querySelector('.room')) {
    root.innerHTML = `<p class="text-muted mb-3">${esc(formatDate(d.appointment.date))} at ${esc(to12h(d.appointment.time))} &middot; ${esc(d.appointment.appointmentId)}</p>
      <div class="room"><div class="stage" id="stage"></div>
      <div class="chat"><div class="chat-log" id="log" role="log" aria-live="polite" aria-label="Chat messages"></div>
        <form class="chat-form" id="chat-form"><label class="visually-hidden" for="text">Message</label><input class="form-control" id="text" maxlength="1000" autocomplete="off" placeholder="Type a message"><button class="btn btn-brand" type="submit" id="send">Send</button></form></div></div>
      <p class="mt-3"><a class="btn btn-ghost" href="${back}">Back to appointments</a></p>`;
    document.getElementById('chat-form').addEventListener('submit', send);
  }

  document.getElementById('stage').innerHTML = `<div class="avatar" aria-hidden="true"><i class="fa-solid fa-user-doctor"></i></div><strong>${esc(other)}</strong>
    <small>${s ? (s.status === 'in-progress' ? 'Consultation in progress' : s.status === 'ended' ? 'Consultation ended' : 'Waiting to start') : (d.reason || 'Not started yet')}</small>
    ${d.canStart ? '<button type="button" class="btn btn-brand" id="start">Start consultation</button>' : ''}
    ${isDoctor && live ? '<button type="button" class="btn btn-danger" id="end">End consultation</button>' : ''}
    ${!isDoctor && !live && s?.status !== 'ended' && !d.reason ? '<small>Please wait. Your doctor will start the session.</small>' : ''}
    <small>Demo: chat only, no camera or microphone.</small>`;
  document.getElementById('start')?.addEventListener('click', async (e) => { setLoading(e.currentTarget, true, 'Starting...'); try { showToast((await api.post(`/teleconsultations/${encodeURIComponent(id)}/start`)).message, 'success'); } catch (err) { showToast(err.message, 'error'); } refresh(); });
  document.getElementById('end')?.addEventListener('click', () => confirmModal({ title: 'End the consultation?', message: 'The chat will close. Remember to mark the appointment completed and write the prescription afterwards.', confirmLabel: 'Yes, end it', onConfirm: async () => { showToast((await api.post(`/teleconsultations/${encodeURIComponent(id)}/end`)).message, 'success'); refresh(); } }));

  const msgs = s ? s.messages : [];
  if (msgs.length !== lastCount) { // only redraw the chat when something changed, so typing is never interrupted
    lastCount = msgs.length;
    const log = document.getElementById('log');
    log.replaceChildren(...(msgs.length ? msgs : [{ text: live ? 'Say hello.' : 'Messages appear here once the consultation starts.', system: true }]).map((m) => {
      const div = document.createElement('div');
      div.className = `msg${m.mine ? ' mine' : ''}`;
      if (!m.system) { const who = document.createElement('span'); who.className = 'who'; who.textContent = m.mine ? 'You' : m.name; div.appendChild(who); }
      div.appendChild(document.createTextNode(m.text));
      return div;
    }));
    log.scrollTop = log.scrollHeight;
  }
  document.getElementById('text').disabled = !live;
  document.getElementById('send').disabled = !live;
  clearTimeout(timer);
  if (!s || s.status !== 'ended') timer = setTimeout(() => refresh(), 4000);
}

async function send(event) {
  event.preventDefault();
  const input = document.getElementById('text');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  try { await api.post(`/teleconsultations/${encodeURIComponent(id)}/messages`, { text }); } catch (error) { showToast(error.message, 'error'); input.value = text; }
  refresh();
}
