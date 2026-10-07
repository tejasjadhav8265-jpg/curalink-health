import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { openModal } from '../components/modal.js';
import { esc, stateBox, setLoading, showNotice } from '../core/ui.js';
import { showToast } from '../core/toast.js';
import { formatDate, formatDay } from '../core/dates.js';

const user = await requireRole('patient');
mountLayout({ user, active: 'feedback' });
const root = document.getElementById('root');

const starsHtml = (name, label) => `<fieldset class="stars-input"><legend>${esc(label)}</legend><div class="row-stars">${[1, 2, 3, 4, 5].map((n) =>
  `<label><input type="radio" name="${name}" value="${n}"><span>${n} <i class="fa-solid fa-star" aria-hidden="true"></i></span></label>`).join('')}</div></fieldset>`;
const stars = (n) => `${'&#9733;'.repeat(n)}${'&#9734;'.repeat(5 - n)}`;

async function load() {
  try {
    const [{ visits }, { reviews }] = await Promise.all([api.get('/feedback/pending').then((r) => r.data), api.get('/feedback/mine').then((r) => r.data)]);
    root.innerHTML = `<h2 class="h4">Visits waiting for your review</h2>
      ${visits.length ? `<ul class="mini-list panel">${visits.map((v) => `<li class="d-flex justify-content-between align-items-center gap-3 flex-wrap"><span><strong>${esc(v.doctor)}</strong> <span class="text-muted">${esc(v.specialization)}</span><br><span class="when">${esc(formatDate(v.appointmentDate))} &middot; ${esc(v.appointmentId)}</span></span>
        <button type="button" class="btn btn-brand btn-sm-brand" data-review="${esc(v._id)}" data-name="${esc(v.doctor)}">Write a review</button></li>`).join('')}</ul>`
      : `<div class="panel"><p class="mb-2 text-muted">Nothing to review right now. You can review a visit after the doctor marks it completed.</p><a class="btn btn-ghost" href="${PATHS.patient.appointments}">My appointments</a></div>`}
      <h2 class="h4 mt-5">My reviews</h2>
      ${reviews.length ? `<ul class="mini-list panel">${reviews.map((r) => `<li><strong>${esc(r.doctor)}</strong> <span class="when">${esc(formatDay(r.createdAt))}${r.status === 'hidden' ? ' &middot; hidden by the hospital' : ''}</span>
        <br><span aria-label="Doctor ${r.doctorRating} out of 5, hospital ${r.hospitalRating} out of 5, staff ${r.staffRating} out of 5">Doctor <span style="color:#8A5A00">${stars(r.doctorRating)}</span> &middot; Hospital <span style="color:#8A5A00">${stars(r.hospitalRating)}</span> &middot; Staff <span style="color:#8A5A00">${stars(r.staffRating)}</span></span>
        ${r.comment ? `<br>${esc(r.comment)}` : ''}</li>`).join('')}</ul>` : '<p class="text-muted">You have not written any reviews yet.</p>'}`;
    root.querySelectorAll('[data-review]').forEach((b) => b.addEventListener('click', () => write(b.dataset.review, b.dataset.name)));
  } catch (error) { root.innerHTML = stateBox('Could not load reviews', error.message); }
}

function write(appointmentId, doctor) {
  const m = openModal({
    title: `Review ${doctor}`,
    bodyHtml: `<form id="rv" novalidate><div id="rv-notice" tabindex="-1"></div>${starsHtml('doctorRating', 'The doctor')}${starsHtml('hospitalRating', 'The hospital')}${starsHtml('staffRating', 'The staff')}
      <div class="field mb-0"><label for="comment">Comment <span class="optional">(optional)</span></label><textarea class="form-control" id="comment" rows="3" maxlength="1000"></textarea>
      <div class="help">Please do not include phone numbers or private medical details. Your first name and last initial are shown.</div></div></form>`,
    footerHtml: '<button type="button" class="btn btn-ghost" data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-brand" id="rv-go">Submit review</button>',
  });
  const val = (n) => { const c = m.el.querySelector(`input[name="${n}"]:checked`); return c ? Number(c.value) : 0; };
  m.el.querySelector('#rv-go').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const notice = m.el.querySelector('#rv-notice');
    const body = { appointmentId, doctorRating: val('doctorRating'), hospitalRating: val('hospitalRating'), staffRating: val('staffRating'), comment: m.el.querySelector('#comment').value.trim() };
    if (!body.comment) delete body.comment;
    if (!body.doctorRating || !body.hospitalRating || !body.staffRating) { showNotice(notice, 'Please give all three ratings.', 'error'); notice.focus(); return; }
    setLoading(button, true, 'Sending...');
    try { const res = await api.post('/feedback', body); showToast(res.message, 'success'); m.close(); load(); }
    catch (error) { setLoading(button, false); showNotice(notice, (error.errors && error.errors[0] && error.errors[0].message) || error.message, 'error'); notice.focus(); }
  });
}
load();
