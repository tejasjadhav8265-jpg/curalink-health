import { getCurrentUser } from '../core/auth.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { renderDoctorCard } from '../components/doctor-card.js';
import { stateBox } from '../core/ui.js';

mountLayout({ user: await getCurrentUser(), active: 'teleconsultation' });
const root = document.getElementById('root');
root.innerHTML = `<div class="two-col-even">
  <section class="info-card"><h2>How it works</h2><ol class="steps">
    <li><span>Choose a doctor who offers <strong>video</strong> and book a time.</span></li>
    <li><span>Wait for the doctor to confirm.</span></li>
    <li><span>On the day, open the appointment and press <em>Open video room</em>.</span></li>
    <li><span>The doctor starts the session and you chat. Afterwards your prescription appears in your account.</span></li></ol>
    <p class="small mt-2">In this demo the room is a text chat. No camera or microphone is used.</p></section>
  <section class="info-card"><h2>Good for</h2><ul><li>Follow-up visits and report reviews</li><li>Common problems such as colds, rashes and stomach upset</li><li>Advice on long-term conditions</li></ul>
    <h2 class="mt-3">Not suitable for</h2><ul><li>Emergencies. Call <a href="tel:112">112</a> or <a href="tel:108">108</a></li><li>Problems that need an examination or tests first</li></ul></section></div>
  <h2 class="h4 mt-5">Doctors who offer video</h2><div id="docs" class="mt-3"><p class="text-muted">Loading doctors...</p></div>`;
const docs = document.getElementById('docs');
try {
  const { doctors } = (await api.get('/doctors?consultationType=video&limit=6')).data;
  docs.innerHTML = doctors.length ? `<div class="stack">${doctors.map((d) => renderDoctorCard(d)).join('')}</div><p class="mt-3"><a class="btn btn-ghost" href="${PATHS.findDoctor}?consultationType=video">See all video doctors</a></p>` : stateBox('No video doctors yet', 'Please check back soon.');
} catch (error) { docs.innerHTML = stateBox('Could not load doctors', error.message); }
