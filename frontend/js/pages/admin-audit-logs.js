import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { mountLayout } from '../components/layout.js';
import { pagerHtml, bindPager } from '../components/pager.js';
import { esc, stateBox } from '../core/ui.js';
import { formatDateTime } from '../core/dates.js';

const user = await requireRole('admin');
mountLayout({ user, active: 'audit-logs' });
const root = document.getElementById('root');
root.innerHTML = `<div class="panel">
  <div class="toolbar">
    <div class="field grow"><label for="q">Search the description</label><input class="form-control" id="q" type="search" maxlength="60" autocomplete="off"></div>
    <div class="field"><label for="action">Action</label><select class="form-select" id="action"><option value="">All actions</option></select></div>
    <div class="field"><label for="from">From</label><input class="form-control" id="from" type="date"></div>
    <div class="field"><label for="to">To</label><input class="form-control" id="to" type="date"></div>
    <button type="button" class="btn btn-ghost" id="clear">Clear</button>
  </div>
  <div id="results" aria-live="polite"><p class="text-muted">Loading...</p></div></div>`;
const results = document.getElementById('results');
const $ = (id) => document.getElementById(id);
let page = 1;
let timer;
let actionsLoaded = false;

async function load() {
  const params = new URLSearchParams({ page, limit: 20 });
  ['q', 'action', 'from', 'to'].forEach((k) => { const v = $(k).value.trim(); if (v) params.set(k, v); });
  try {
    const { logs, actions, pagination } = (await api.get(`/admin/audit-logs?${params}`)).data;
    if (!actionsLoaded) { $('action').insertAdjacentHTML('beforeend', actions.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join('')); actionsLoaded = true; }
    if (!logs.length) { results.innerHTML = stateBox('No records found', 'Try different filters.'); return; }
    results.innerHTML = `<div class="data-table-wrap"><table class="data-table"><caption class="visually-hidden">Audit logs</caption>
      <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Details</th></tr></thead>
      <tbody>${logs.map((l) => `<tr><td class="log-meta">${esc(formatDateTime(l.timestamp))}</td>
        <td>${esc(l.by)}${l.role ? `<span class="sub">${esc(l.role)}</span>` : ''}</td>
        <td><span class="log-action">${esc(l.action)}</span></td>
        <td>${esc(l.description || '-')}${l.ip ? `<span class="sub">IP ${esc(l.ip)}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>
      ${pagerHtml(pagination)}`;
    bindPager(results, (step) => { page += step; load(); });
  } catch (error) { results.innerHTML = stateBox('Could not load the logs', error.message); }
}

$('q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { page = 1; load(); }, 300); });
['action', 'from', 'to'].forEach((k) => $(k).addEventListener('change', () => { page = 1; load(); }));
$('clear').addEventListener('click', () => { ['q', 'action', 'from', 'to'].forEach((k) => { $(k).value = ''; }); page = 1; load(); });
load();
