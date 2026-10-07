import { getCurrentUser } from '../core/auth.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { esc, formatFee, safeImage, rating, stateBox } from '../core/ui.js';

mountLayout({ user: await getCurrentUser(), active: 'find-doctor' });

const params = new URLSearchParams(window.location.search);
const id = params.get('id');
const root = document.getElementById('profile');
const crumb = document.getElementById('crumb');

const DAYS = [['monday', 'Monday'], ['tuesday', 'Tuesday'], ['wednesday', 'Wednesday'], ['thursday', 'Thursday'], ['friday', 'Friday'], ['saturday', 'Saturday'], ['sunday', 'Sunday']];
const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }).toLowerCase();

// "09:00" -> "9:00 AM"
const to12h = (hm) => { const [h, m] = hm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
const stars = (n) => `<span class="stars" aria-hidden="true">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span><span class="visually-hidden">${n} out of 5</span>`;
const list = (items) => (items && items.length ? `<ul class="pill-list">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p class="text-muted mb-0">Not listed.</p>');

function scheduleTable(schedule) {
  if (!schedule) return '<p class="text-muted mb-0">The doctor has not published a schedule yet.</p>';
  const rows = DAYS.map(([key, label]) => {
    const windows = schedule.weekly[key] || [];
    return `<tr class="${key === todayName ? 'today' : ''}"><th scope="row">${label}</th><td>${windows.length
      ? windows.map((w) => `${to12h(w.start)} to ${to12h(w.end)}`).join('<br>') : '<span class="closed">Closed</span>'}</td></tr>`;
  }).join('');
  const leave = (schedule.blockedDates || []).length
    ? `<p class="small text-muted mt-3 mb-0">Not available on: ${schedule.blockedDates.map(esc).join(', ')}</p>` : '';
  return `<table class="schedule"><caption class="visually-hidden">Weekly OPD timings</caption><tbody>${rows}</tbody></table>
    <p class="small text-muted mt-3 mb-0">Each visit is a ${esc(schedule.slotDuration)}-minute slot.</p>${leave}`;
}

function reviewsHtml(reviews, doctor) {
  if (!reviews.length) return '<p class="text-muted mb-0">No reviews yet. Only patients who have completed a visit can leave a review.</p>';
  return reviews.map((r) => `<div class="review">
    <div class="review-top"><strong>${esc(r.name)}</strong>${stars(r.doctorRating)}
      ${r.verified ? '<span class="verified"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Verified visit</span>' : ''}
      <span class="text-muted small">${esc(new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))}</span></div>
    ${r.comment ? `<p class="mb-0">${esc(r.comment)}</p>` : ''}</div>`).join('');
}

if (!id) {
  crumb.textContent = 'Not found';
  root.innerHTML = stateBox('No doctor selected', 'Choose a doctor from the search results.', { href: PATHS.findDoctor, label: 'Find a doctor' });
} else {
  try {
    const { doctor, schedule, reviews } = (await api.get(`/doctors/${encodeURIComponent(id)}`)).data;
    document.title = `${doctor.name} | CuraLink Health`;
    crumb.textContent = doctor.name;

    const book = `${PATHS.bookAppointment}?doctor=${encodeURIComponent(doctor._id)}`;
    const hasVideo = (doctor.consultationTypes || []).includes('video');
    const a = doctor.availability || {};
    const availText = a.today ? 'Available today' : a.tomorrow ? 'Available tomorrow' : (a.days && a.days.length ? `Available ${a.days.join(', ')}` : 'Schedule not set');
    const contact = `${PATHS.contact}?subject=${encodeURIComponent(`Question for ${doctor.name}`)}`;

    root.innerHTML = `
    <section class="profile-head">
      <img class="profile-photo" src="${esc(safeImage(doctor.profileImage))}" alt="Photo of ${esc(doctor.name)}" width="160" height="160">
      <div>
        <h1>${esc(doctor.name)}</h1>
        <p class="doc-spec mb-1">${esc(doctor.specialization)}${doctor.department ? ` <span class="text-muted">in ${esc(doctor.department.name)}</span>` : ''}</p>
        <p class="text-muted mb-2">${esc(doctor.qualification || '')}</p>
        <p class="mb-2"><i class="fa-solid fa-star star" style="color:#C98A0B" aria-hidden="true"></i> <strong>${esc(rating(doctor.ratingAvg))}</strong>
          ${doctor.ratingCount ? `<span class="text-muted">(${esc(doctor.ratingCount)} reviews)</span>` : ''}
          <span class="mx-2 text-muted" aria-hidden="true">|</span>${esc(doctor.experience)} years experience</p>
        <p class="mb-0"><span class="badge-avail ${a.today ? 'now' : a.tomorrow ? 'soon' : 'later'}">${esc(availText)}</span></p>
      </div>
      <div class="profile-actions">
        <p class="fee">${esc(formatFee(doctor.consultationFee))} <span class="small text-muted fw-normal">per visit</span></p>
        <a class="btn btn-brand" href="${book}">Book appointment</a>
        ${hasVideo ? `<a class="btn btn-ghost" href="${book}&type=video"><i class="fa-solid fa-video me-2" aria-hidden="true"></i>Video consultation</a>` : ''}
        <a class="btn btn-ghost" href="${contact}">Contact</a>
      </div>
    </section>

    <div class="profile-grid">
      <div>
        <section class="panel"><h2>About</h2><p class="mb-0">${esc(doctor.about || 'No description provided.')}</p></section>
        <section class="panel"><h2>Conditions treated</h2>${list(doctor.conditionsTreated)}</section>
        <section class="panel"><h2>Procedures</h2>${list(doctor.procedures)}</section>
        <section class="panel"><h2>Patient reviews</h2>${reviewsHtml(reviews, doctor)}</section>
      </div>
      <div>
        <section class="panel"><h2>OPD timings</h2>${scheduleTable(schedule)}</section>
        <section class="panel"><h2>Details</h2>
          <ul class="fact-list">
            <li><span>Registration number</span><span>${esc(doctor.registrationNumber)}</span></li>
            <li><span>Location</span><span>${esc(doctor.location)}${doctor.branch ? `<br>${esc(doctor.branch)}` : ''}</span></li>
            <li><span>Languages</span><span>${esc((doctor.languages || []).join(', ') || 'Not listed')}</span></li>
            <li><span>Visit types</span><span>${esc((doctor.consultationTypes || []).map((t) => (t === 'video' ? 'Video' : 'In-person')).join(', '))}</span></li>
          </ul>
        </section>
      </div>
    </div>`;
  } catch (error) {
    crumb.textContent = 'Not found';
    root.innerHTML = stateBox(error.status === 404 ? 'Doctor not found' : 'Could not load this profile', error.message, { href: PATHS.findDoctor, label: 'Find a doctor' });
  }
}
