import { getCurrentUser } from '../core/auth.js';
import { api } from '../core/api.js';
import { mountLayout } from '../components/layout.js';
import { inputHtml, textareaHtml, clearErrors, showServerErrors } from '../components/form-kit.js';
import { setLoading, showNotice } from '../core/ui.js';

const user = await getCurrentUser();
mountLayout({ user, active: 'contact' });
const root = document.getElementById('root');
root.innerHTML = `<div class="two-col-even">
  <form class="form-card" id="form" novalidate>
    <div id="notice" tabindex="-1" role="status"></div>
    ${inputHtml('name', 'Your name')}${inputHtml('email', 'Email', { type: 'email', max: 254, hint: 'We reply to this address.' })}
    ${inputHtml('phone', 'Mobile number', { required: false, max: 15, attrs: 'inputmode="tel"' })}
    ${inputHtml('subject', 'Subject', { max: 150 })}${textareaHtml('message', 'Message', { max: 2000, rows: 5, hint: 'Please do not include medical details you want kept private.' })}
    <button class="btn btn-brand" type="submit" id="send">Send message</button>
  </form>
  <aside class="info-card"><h2>Other ways to reach us</h2>
    <p><i class="fa-solid fa-triangle-exclamation me-2" aria-hidden="true"></i><strong>Emergency?</strong> Call <a href="tel:112">112</a> or <a href="tel:108">108</a>.</p>
    <p><i class="fa-solid fa-location-dot me-2" aria-hidden="true"></i>Demo address: CuraLink Health, Gangapur Road, Nashik (fictional).</p>
    <p><i class="fa-regular fa-clock me-2" aria-hidden="true"></i>We read messages on weekdays and reply within two working days.</p>
    <p class="small">This is a demonstration site. Messages go to the demo admin inbox only.</p></aside></div>`;

const form = document.getElementById('form');
if (user) { form.elements.name.value = user.fullName || ''; form.elements.email.value = user.email || ''; }
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors(form);
  const notice = document.getElementById('notice');
  notice.innerHTML = '';
  const body = Object.fromEntries(['name', 'email', 'phone', 'subject', 'message'].map((k) => [k, form.elements[k].value.trim()]));
  if (!body.phone) delete body.phone;
  const button = document.getElementById('send');
  setLoading(button, true, 'Sending...');
  try {
    const res = await api.post('/contact', body);
    form.reset();
    if (user) { form.elements.name.value = user.fullName || ''; form.elements.email.value = user.email || ''; }
    showNotice(notice, res.message, 'success');
    notice.focus();
  } catch (error) { showServerErrors(form, notice, error); }
  setLoading(button, false);
});
