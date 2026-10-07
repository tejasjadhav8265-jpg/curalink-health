import { getCurrentUser } from '../core/auth.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { inputHtml, selectHtml, clearErrors, showServerErrors } from '../components/form-kit.js';
import { esc, stateBox, setLoading, showNotice } from '../core/ui.js';
import { formatDay } from '../core/dates.js';

const user = await getCurrentUser();
mountLayout({ user, active: 'insurance' });
const root = document.getElementById('root');
const isPatient = user && user.role === 'patient';
const STATUS = { submitted: ['Submitted', 'st-pending'], verified: ['Verified', 'st-confirmed'], rejected: ['Not accepted', 'st-cancelled'] };
let insurers = [];
try { insurers = (await api.get('/insurance/providers')).data.providers; } catch (error) { root.innerHTML = stateBox('Could not load this page', error.message); throw error; }

root.innerHTML = `<div class="two-col-even">
  <section>
    <div class="prose-note"><strong>Demo note.</strong> Policies here are checked by hand by the hospital desk. No insurer is contacted and cashless treatment is not available in this demo.</div>
    <div id="mine"></div>
  </section>
  <section>${isPatient ? `<form class="form-card" id="form" novalidate><h2 class="h5">Add a policy</h2><div id="notice" tabindex="-1" role="status"></div>
      ${selectHtml('provider', 'Insurance provider', insurers)}${inputHtml('policyNumber', 'Policy number', { max: 30 })}
      ${inputHtml('patientIdRef', 'Member or card ID', { required: false, max: 30, hint: 'The ID printed on your card, if it is different from the policy number.' })}
      <button class="btn btn-brand" type="submit" id="save">Submit policy</button></form>`
    : `<div class="info-card"><h2>Share your policy</h2><p>${user ? 'Only patient accounts can add a policy.' : 'Log in as a patient to add your policy and see its status.'}</p>${user ? '' : `<a class="btn btn-brand" href="${PATHS.login}?next=${encodeURIComponent(window.location.pathname)}">Log in</a>`}</div>`}</section></div>`;

async function loadMine() {
  const box = document.getElementById('mine');
  if (!isPatient) { box.innerHTML = '<div class="info-card"><h2>What to keep ready</h2><ul><li>Your policy number</li><li>Your member or card ID</li><li>A photo ID</li><li>The insurer\'s helpline number</li></ul></div>'; return; }
  try {
    const { policies } = (await api.get('/insurance/mine')).data;
    box.innerHTML = `<h2 class="h5">My policies</h2>${policies.length ? policies.map((p) => `<div class="info-card mb-2"><div class="d-flex justify-content-between gap-2"><strong>${esc(p.provider)}</strong><span class="st ${(STATUS[p.status] || STATUS.submitted)[1]}">${esc((STATUS[p.status] || STATUS.submitted)[0])}</span></div>
      <p>Policy ${esc(p.policyNumber)}${p.patientIdRef ? ` &middot; ID ${esc(p.patientIdRef)}` : ''}</p><p class="small">Added ${esc(formatDay(p.createdAt))}</p></div>`).join('') : '<p class="text-muted">No policies added yet.</p>'}`;
  } catch (error) { box.innerHTML = stateBox('Could not load your policies', error.message); }
}

const form = document.getElementById('form');
if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);
    const notice = document.getElementById('notice');
    notice.innerHTML = '';
    const body = { provider: form.elements.provider.value, policyNumber: form.elements.policyNumber.value.trim(), patientIdRef: form.elements.patientIdRef.value.trim() };
    if (!body.patientIdRef) delete body.patientIdRef;
    const button = document.getElementById('save');
    setLoading(button, true, 'Saving...');
    try { const res = await api.post('/insurance', body); form.reset(); showNotice(notice, res.message, 'success'); loadMine(); }
    catch (error) { showServerErrors(form, notice, error); }
    setLoading(button, false);
  });
}
loadMine();
