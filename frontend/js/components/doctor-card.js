import { PATHS } from '../core/config.js';
import { esc, formatFee, safeImage, rating } from '../core/ui.js';

const typeLabel = { 'in-person': 'In-person', video: 'Video' };

function availabilityBadge(a) {
  if (!a) return '';
  if (a.today) return '<span class="badge-avail now"><i class="fa-solid fa-circle" aria-hidden="true"></i> Available today</span>';
  if (a.tomorrow) return '<span class="badge-avail soon"><i class="fa-regular fa-clock" aria-hidden="true"></i> Available tomorrow</span>';
  return a.days && a.days.length
    ? `<span class="badge-avail later"><i class="fa-regular fa-calendar" aria-hidden="true"></i> ${esc(a.days.join(', '))}</span>`
    : '<span class="badge-avail later">Schedule not set</span>';
}

// One doctor as a card. `searchId` (optional) lets the Find doctor page record which result was opened.
export function renderDoctorCard(doc, { searchId = '' } = {}) {
  const profile = `${PATHS.doctorDetails}?id=${encodeURIComponent(doc._id)}${searchId ? `&s=${encodeURIComponent(searchId)}` : ''}`;
  const book = `${PATHS.bookAppointment}?doctor=${encodeURIComponent(doc._id)}`;
  const dept = doc.department && doc.department.name ? doc.department.name : '';
  return `<article class="doc-card">
    <img class="doc-photo" src="${esc(safeImage(doc.profileImage))}" alt="Photo of ${esc(doc.name)}" width="96" height="96" loading="lazy">
    <div class="doc-main">
      <h3 class="doc-name"><a href="${profile}" data-doctor="${esc(doc._id)}">${esc(doc.name)}</a></h3>
      <p class="doc-spec">${esc(doc.specialization)}${dept && dept !== doc.specialization ? ` <span class="text-muted">in ${esc(dept)}</span>` : ''}</p>
      <p class="doc-meta">${esc(doc.qualification || '')}</p>
      <ul class="doc-facts">
        <li><i class="fa-solid fa-briefcase-medical" aria-hidden="true"></i> ${esc(doc.experience)} years experience</li>
        <li><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${esc(doc.location)}${doc.branch ? `, ${esc(doc.branch)}` : ''}</li>
        <li><i class="fa-solid fa-star star" aria-hidden="true"></i> <strong>${esc(rating(doc.ratingAvg))}</strong>${doc.ratingCount ? ` <span class="text-muted">(${esc(doc.ratingCount)} reviews)</span>` : ''}</li>
      </ul>
      <p class="doc-tags">${availabilityBadge(doc.availability)}${(doc.consultationTypes || []).map((t) => `<span class="tag">${esc(typeLabel[t] || t)}</span>`).join('')}</p>
    </div>
    <div class="doc-side">
      <p class="doc-fee"><span class="text-muted small">Consultation fee</span><strong>${esc(formatFee(doc.consultationFee))}</strong></p>
      <a class="btn btn-brand" href="${book}">Book appointment</a>
      <a class="btn btn-ghost" href="${profile}" data-doctor="${esc(doc._id)}">View profile</a>
    </div>
  </article>`;
}
