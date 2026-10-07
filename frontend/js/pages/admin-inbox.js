import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { mountLayout } from '../components/layout.js';
import { pagerHtml, bindPager } from '../components/pager.js';
import { esc, stateBox } from '../core/ui.js';
import { showToast } from '../core/toast.js';
import { formatDateTime } from '../core/dates.js';

const user = await requireRole('admin');
mountLayout({ user, active: 'inbox' });
const root = document.getElementById('root');
const TABS = [['contact', 'Messages'], ['emergency', 'Ambulance'], ['insurance', 'Insurance'], ['packages', 'Packages'], ['feedback', 'Reviews']];
const initial = new URLSearchParams(window.location.search).get('tab');
let kind = TABS.some(([k]) => k === initial) ? initial : 'contact';
let status = '';
let page = 1;
let counts = {};

root.innerHTML = `<div class="panel"><div class="filter-bar" role="tablist" aria-label="Request types" id="tabs"></div>
  <div class="toolbar"><div class="field"><label for="status">Status</label><select class="form-select" id="status"><option value="">All</option></select></div></div>
  <div id="results" aria-live="polite"><p class="text-muted">Loading...</p></div></div>`;
const $ = (id) => document.getElementById(id);
const results = $('results');

function drawTabs() {
  $('tabs').innerHTML = TABS.map(([k, label]) => `<button type="button" role="tab" class="chip${k === kind ? ' on' : ''}" aria-selected="${k === kind}" data-kind="${k}">${esc(label)}${counts[k] ? ` <span class="badge text-bg-warning">${esc(counts[k])}</span><span class="visually-hidden"> waiting</span>` : ''}</button>`).join('');
  $('tabs').querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => { kind = b.dataset.kind; status = ''; page = 1; load(); }));
}

async function load() {
  try { counts = (await api.get('/admin/inbox')).data.counts; } catch (_) { counts = {}; }
  drawTabs();
  const params = new URLSearchParams({ page, limit: 10 });
  if (status) params.set('status', status);
  try {
    const { items, statuses, pagination } = (await api.get(`/admin/inbox/${kind}?${params}`)).data;
    $('status').innerHTML = `<option value="">All</option>${statuses.map((s) => `<option value="${esc(s)}"${s === status ? ' selected' : ''}>${esc(s)}</option>`).join('')}`;
    if (!items.length) { results.innerHTML = stateBox('Nothing here', 'No items match this filter.'); return; }
    results.innerHTML = `<div class="data-table-wrap"><table class="data-table"><caption class="visually-hidden">${esc(kind)} requests</caption>
      <thead><tr><th scope="col">Received</th><th scope="col">Details</th><th scope="col">From</th><th scope="col">Status</th></tr></thead>
      <tbody>${items.map((i) => `<tr><td class="log-meta">${esc(formatDateTime(i.createdAt))}${i.reference ? `<span class="sub">${esc(i.reference)}</span>` : ''}</td>
        <td><span class="name">${esc(i.title)}</span><span class="sub">${esc(i.body)}</span></td>
        <td>${esc(i.from)}<span class="sub">${esc([i.email, i.phone].filter(Boolean).join(' · '))}</span></td>
        <td><label class="visually-hidden" for="st-${esc(i._id)}">Status</label><select class="form-select form-select-sm" id="st-${esc(i._id)}" data-id="${esc(i._id)}" data-prev="${esc(i.status)}">${statuses.map((s) => `<option value="${esc(s)}"${s === i.status ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>${pagerHtml(pagination)}`;
    bindPager(results, (step) => { page += step; load(); });
    results.querySelectorAll('select[data-id]').forEach((sel) => sel.addEventListener('change', async () => {
      sel.disabled = true;
      try { await api.patch(`/admin/inbox/${kind}/${sel.dataset.id}`, { status: sel.value }); showToast('Status updated.', 'success'); sel.dataset.prev = sel.value; load(); }
      catch (error) { sel.value = sel.dataset.prev; sel.disabled = false; showToast(error.message, 'error'); }
    }));
  } catch (error) { results.innerHTML = stateBox('Could not load this list', error.message); }
}
$('status').addEventListener('change', (e) => { status = e.target.value; page = 1; load(); });
load();
