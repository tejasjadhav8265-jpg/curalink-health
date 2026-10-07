import { getCurrentUser } from '../core/auth.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { inputHtml, textareaHtml, selectHtml, clearErrors, showServerErrors } from '../components/form-kit.js';
import { setLoading, showNotice, stateBox, esc } from '../core/ui.js';

const user = await getCurrentUser();
mountLayout({ user, active: 'ambulance' });
const root = document.getElementById('root');
let types = [];
try { types = (await api.get('/meta')).data.emergencyTypes; } catch (error) { root.innerHTML = stateBox('Could not load this page', error.message); throw error; }

root.innerHTML = `<div class="red-alert"><strong>Real emergency? Call 108 or 112 now.</strong>This form is a demo. It records a request for practice, but no ambulance is sent. <a href="${PATHS.emergency}">See emergency numbers</a>.</div>
  <div class="two-col-even">
    <form class="form-card" id="form" novalidate>
      <div id="notice" tabindex="-1" role="status"></div>
      ${inputHtml('patientName', "Patient's name")}${inputHtml('phone', 'Mobile number to call back', { max: 15, attrs: 'inputmode="tel"' })}
      ${inputHtml('pickupLocation', 'Pickup location', { max: 300, hint: 'House or building, street, landmark and city.' })}
      ${selectHtml('emergencyType', 'What happened?', types)}
      ${inputHtml('patientCount', 'Number of patients', { type: 'number', required: false, attrs: 'min="1" max="20" value="1" inputmode="numeric"' })}
      ${textareaHtml('additionalInfo', 'Anything else the crew should know', { required: false, rows: 3 })}
      <button class="btn btn-danger" type="submit" id="send"><i class="fa-solid fa-truck-medical me-1" aria-hidden="true"></i>Send demo request</button>
    </form>
    <aside class="info-card"><h2>How a real request works</h2>
      <ol class="steps"><li><span>You share who needs help and where.</span></li><li><span>The control room confirms by phone.</span></li><li><span>The nearest ambulance is sent, with a trained crew.</span></li><li><span>The patient is taken to the nearest suitable hospital.</span></li></ol>
      <p class="small mt-2">The admin can see your demo request under <em>Requests</em>.</p></aside>
  </div>`;

const form = document.getElementById('form');
if (user) { form.elements.patientName.value = user.fullName || ''; }
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors(form);
  const notice = document.getElementById('notice');
  notice.innerHTML = '';
  const body = { patientName: form.elements.patientName.value.trim(), phone: form.elements.phone.value.trim(), pickupLocation: form.elements.pickupLocation.value.trim(), emergencyType: form.elements.emergencyType.value, additionalInfo: form.elements.additionalInfo.value.trim() };
  if (form.elements.patientCount.value) body.patientCount = Number(form.elements.patientCount.value);
  if (!body.additionalInfo) delete body.additionalInfo;
  const button = document.getElementById('send');
  setLoading(button, true, 'Sending...');
  try {
    const res = await api.post('/emergency', body);
    form.reset();
    showNotice(notice, `${res.message} Reference: ${res.data.reference}`, 'success');
    notice.focus();
  } catch (error) { showServerErrors(form, notice, error); }
  setLoading(button, false);
});
