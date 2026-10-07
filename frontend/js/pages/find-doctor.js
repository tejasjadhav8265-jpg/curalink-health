import { getCurrentUser } from '../core/auth.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { renderDoctorCard } from '../components/doctor-card.js';
import { esc, skeletonCards, stateBox, formatFee } from '../core/ui.js';
import { showToast } from '../core/toast.js';

mountLayout({ user: await getCurrentUser(), active: 'find-doctor' });

const form = document.getElementById('filter-form');
const sortSelect = document.getElementById('sort');
const results = document.getElementById('results');
const heading = document.getElementById('results-h');
const pager = document.getElementById('pager');
const activeBox = document.getElementById('active-filters');

const FILTER_FIELDS = ['q', 'department', 'location', 'branch', 'consultationType', 'gender', 'language', 'minExperience', 'maxFee', 'minRating'];
let page = 1;
let currentSearchId = '';
let requestCounter = 0; // lets us ignore slow answers that arrive after a newer search

// ---- Fill the drop-downs with real values from the database ----
const facets = (await api.get('/doctors/facets').catch(() => ({ data: null }))).data;
if (facets) {
  facets.departments.forEach((d) => form.department.add(new Option(d.name, d.slug)));
  facets.locations.forEach((v) => form.location.add(new Option(v, v)));
  facets.branches.forEach((v) => form.branch.add(new Option(v, v)));
  facets.languages.forEach((v) => form.language.add(new Option(v, v)));
}

// ---- Read the address bar into the form (so links like ?department=cardiology work) ----
function loadFromUrl() {
  const params = new URLSearchParams(window.location.search);
  FILTER_FIELDS.forEach((name) => { form.elements[name].value = params.get(name) || ''; });
  sortSelect.value = params.get('sort') || 'rating';
  const avail = params.get('availableOn') || '';
  if (avail === 'today' || avail === 'tomorrow' || avail === '') {
    form.querySelectorAll('input[name="availableOn"]').forEach((r) => { r.checked = r.value === avail; });
    form.date.value = '';
  } else {
    form.date.value = avail; // a specific date
    form.querySelectorAll('input[name="availableOn"]').forEach((r) => { r.checked = false; });
  }
  page = Number(params.get('page')) || 1;
}

function currentAvailability() {
  if (form.date.value) return form.date.value;
  const picked = form.querySelector('input[name="availableOn"]:checked');
  return picked ? picked.value : '';
}

// Everything the person chose, as URL parameters (empty values left out).
function collectParams({ includePage = true } = {}) {
  const params = new URLSearchParams();
  FILTER_FIELDS.forEach((name) => { const v = form.elements[name].value.trim(); if (v) params.set(name, v); });
  const avail = currentAvailability();
  if (avail) params.set('availableOn', avail);
  if (sortSelect.value && sortSelect.value !== 'rating') params.set('sort', sortSelect.value);
  if (includePage && page > 1) params.set('page', String(page));
  return params;
}

function describeFilters(params) {
  const labels = [];
  const text = (key, label) => { if (params.get(key)) labels.push(`${label}: ${params.get(key)}`); };
  text('q', 'Search');
  if (params.get('department')) {
    const opt = [...form.department.options].find((o) => o.value === params.get('department'));
    labels.push(`Department: ${opt ? opt.text : params.get('department')}`);
  }
  text('location', 'Location'); text('branch', 'Branch'); text('language', 'Language');
  if (params.get('availableOn')) labels.push(`Available: ${params.get('availableOn')}`);
  if (params.get('consultationType')) labels.push(params.get('consultationType') === 'video' ? 'Video visits' : 'In-person visits');
  if (params.get('gender')) labels.push(`${params.get('gender') === 'female' ? 'Female' : 'Male'} doctor`);
  if (params.get('minExperience')) labels.push(`${params.get('minExperience')}+ years`);
  if (params.get('maxFee')) labels.push(`Up to ${formatFee(params.get('maxFee'))}`);
  if (params.get('minRating')) labels.push(`Rating ${params.get('minRating')}+`);
  return labels;
}

// ---- Run the search ----
// recordHistory is true only when the person actually searched or filtered (not for paging).
async function runSearch({ recordHistory = false } = {}) {
  const params = collectParams();
  const mine = ++requestCounter;
  history.replaceState(null, '', `${window.location.pathname}${params.toString() ? `?${params}` : ''}`);

  results.setAttribute('aria-busy', 'true');
  results.innerHTML = skeletonCards(4);
  heading.textContent = 'Loading doctors...';
  pager.innerHTML = '';
  const labels = describeFilters(params);
  activeBox.innerHTML = labels.map((l) => `<span class="chip">${esc(l)}</span>`).join('');

  try {
    const { data } = await api.get(`/doctors?${params}`);
    if (mine !== requestCounter) return; // a newer search is already running
    const { doctors, pagination } = data;

    heading.textContent = pagination.total === 0 ? 'No doctors found'
      : `${pagination.total} ${pagination.total === 1 ? 'doctor' : 'doctors'} found`;

    if (recordHistory && (labels.length || params.get('q'))) {
      const filters = Object.fromEntries(params.entries());
      api.post('/searches', {
        keyword: params.get('q') || '', specialization: params.get('department') || '', location: params.get('location') || '',
        filters, resultsCount: pagination.total,
      }).then((r) => { currentSearchId = r.data.searchId; }).catch(() => { /* history is best-effort */ });
    }

    results.innerHTML = doctors.length
      ? doctors.map((d) => renderDoctorCard(d, { searchId: currentSearchId })).join('')
      : stateBox('No doctors match these filters', 'Try removing a filter or searching for something broader, like a specialty.');
    renderPager(pagination);
  } catch (error) {
    if (mine !== requestCounter) return;
    heading.textContent = 'Could not load doctors';
    results.innerHTML = stateBox('Something went wrong', error.message);
    showToast(error.message, 'error');
  } finally {
    if (mine === requestCounter) results.setAttribute('aria-busy', 'false');
  }
}

function renderPager({ page: current, pages }) {
  if (pages <= 1) return;
  const button = (label, target, { disabled = false, currentPage = false, aria } = {}) =>
    `<button type="button" data-page="${target}" ${disabled ? 'disabled' : ''} ${currentPage ? 'aria-current="page"' : ''} ${aria ? `aria-label="${aria}"` : ''}>${label}</button>`;
  let html = button('Previous', current - 1, { disabled: current === 1 });
  for (let p = 1; p <= pages; p += 1) html += button(String(p), p, { currentPage: p === current, aria: `Page ${p}` });
  html += button('Next', current + 1, { disabled: current === pages });
  pager.innerHTML = html;
}

pager.addEventListener('click', (event) => {
  const target = event.target.closest('button[data-page]');
  if (!target || target.disabled) return;
  page = Number(target.dataset.page);
  runSearch();
  document.getElementById('results-h').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ---- Re-search when any filter changes (typing waits a moment first) ----
let timer;
const searchSoon = (delay = 0) => { clearTimeout(timer); timer = setTimeout(() => { page = 1; runSearch({ recordHistory: true }); }, delay); };
form.addEventListener('input', (event) => { if (event.target.name === 'q') searchSoon(450); });
form.addEventListener('change', (event) => {
  if (event.target.name === 'q') return;
  if (event.target.name === 'date' && event.target.value) form.querySelectorAll('input[name="availableOn"]').forEach((r) => { r.checked = false; });
  if (event.target.name === 'availableOn') form.date.value = '';
  searchSoon();
});
sortSelect.addEventListener('change', () => searchSoon());
form.addEventListener('submit', (event) => { event.preventDefault(); searchSoon(); });
document.getElementById('reset-btn').addEventListener('click', () => {
  form.reset(); sortSelect.value = 'rating'; form.date.value = ''; searchSoon();
});

// A date in the past can't be booked, so the picker starts from today.
const now = new Date();
form.date.min = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

// Remember which result was opened (shows up in the admin "most searched doctors" report).
results.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-doctor]');
  if (link && currentSearchId) {
    api.patch(`/searches/${encodeURIComponent(currentSearchId)}/click`, { doctorId: link.dataset.doctor }).catch(() => {});
  }
});

loadFromUrl();
// Arriving from a link that already has filters (home page search, a department) counts as a search.
runSearch({ recordHistory: [...new URLSearchParams(window.location.search).keys()].some((k) => k !== 'page') });
