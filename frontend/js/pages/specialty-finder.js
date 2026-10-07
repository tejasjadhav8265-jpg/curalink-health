import { getCurrentUser } from '../core/auth.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { textareaHtml, clearErrors, showServerErrors } from '../components/form-kit.js';
import { esc, setLoading } from '../core/ui.js';

mountLayout({ user: await getCurrentUser(), active: 'finder' });
const root = document.getElementById('root');
root.innerHTML = `<div class="two-col-even">
  <form class="form-card" id="form" novalidate><div id="notice" tabindex="-1" role="status"></div>
    ${textareaHtml('text', 'How are you feeling?', { max: 400, rows: 4, hint: 'For example: "itchy rash on my arms for a week" or "my son has fever and cough".' })}
    <button class="btn btn-brand" type="submit" id="go">Suggest a department</button></form>
  <div id="out" aria-live="polite"><div class="info-card"><h2>How this works</h2><p>We look for words in what you write and suggest where to start. It does not understand your health and can be wrong. It is not a diagnosis.</p></div></div></div>`;
const form = document.getElementById('form');
const out = document.getElementById('out');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors(form);
  const notice = document.getElementById('notice');
  notice.innerHTML = '';
  const button = document.getElementById('go');
  setLoading(button, true, 'Thinking...');
  try {
    const { redFlags, suggestions, fallback } = (await api.get(`/specialty-finder?text=${encodeURIComponent(form.elements.text.value.trim())}`)).data;
    const alert = redFlags.length ? `<div class="red-alert" role="alert"><strong>${redFlags.some((r) => r.mental) ? 'You are not alone. Please reach out now.' : 'This could be an emergency.'}</strong>
      ${esc(redFlags.map((r) => r.label).join(', '))}.
      ${redFlags.some((r) => r.mental) ? 'Call Tele-MANAS on <a href="tel:14416">14416</a> (free) or <a href="tel:112">112</a>.' : 'Call <a href="tel:112">112</a> or <a href="tel:108">108</a> now, or go to the nearest hospital. Do not wait for an appointment.'}</div>` : '';
    out.innerHTML = `${alert}${fallback ? '<p class="text-muted">We could not match those words, so a general physician is a good place to start.</p>' : '<h2 class="h5">You could start with</h2>'}
      ${suggestions.map((s) => `<div class="finder-result"><h3>${esc(s.department)}</h3>
        ${s.because.length ? `<p class="small text-muted mb-2">Because you mentioned: ${esc(s.because.join(', '))}</p>` : ''}
        <a class="btn btn-brand btn-sm-brand" href="${s.slug ? `${PATHS.departmentDetails}?slug=${encodeURIComponent(s.slug)}` : PATHS.findDoctor}">See ${esc(s.department)} doctors</a></div>`).join('')}
      <p class="small text-muted">General guidance only. See the <a href="${PATHS.disclaimer}">medical disclaimer</a>.</p>`;
  } catch (error) { showServerErrors(form, notice, error); }
  setLoading(button, false);
});
