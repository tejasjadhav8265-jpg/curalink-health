import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { mountLayout, setBell } from '../components/layout.js';
import { esc, stateBox } from '../core/ui.js';
import { showToast } from '../core/toast.js';
import { formatDateTime } from '../core/dates.js';

const user = await requireRole(document.body.dataset.role || 'patient');
mountLayout({ user, active: 'notifications' });
const root = document.getElementById('notifs');

const ICONS = { registration: 'fa-hand-sparkles', appointment_confirmation: 'fa-calendar-check', appointment_reminder: 'fa-bell', appointment_cancellation: 'fa-calendar-xmark', appointment_rescheduled: 'fa-calendar-days', prescription_available: 'fa-prescription-bottle-medical', report_uploaded: 'fa-file-medical', payment_confirmation: 'fa-receipt', doctor_response: 'fa-user-doctor', general: 'fa-circle-info' };
const safeLink = (l) => (typeof l === 'string' && /^\/pages\/[A-Za-z0-9\/_\-.]+\.html(\?[A-Za-z0-9=&_%\-]*)?$/.test(l) ? l : null);
let unreadOnly = false;
let page = 1;

function item(n) {
  const link = safeLink(n.link);
  return `<li class="notif ${n.isRead ? '' : 'unread'}">
    <span class="notif-icon" aria-hidden="true"><i class="fa-solid ${ICONS[n.type] || ICONS.general}"></i></span>
    <div><h2>${esc(n.title)}${n.isRead ? '' : ' <span class="visually-hidden">(unread)</span>'}</h2><p>${esc(n.message)}</p><span class="when">${esc(formatDateTime(n.createdAt))}</span></div>
    <div class="notif-actions">
      ${link ? `<button type="button" class="link-btn" data-open="${esc(n._id)}" data-href="${esc(link)}">Open</button>` : ''}
      ${n.isRead ? '' : `<button type="button" class="link-btn" data-read="${esc(n._id)}">Mark read</button>`}
      <button type="button" class="link-btn danger" data-del="${esc(n._id)}" aria-label="Delete notification: ${esc(n.title)}">Delete</button>
    </div></li>`;
}

async function load() {
  try {
    const { notifications, unreadCount, pagination } = (await api.get(`/notifications?page=${page}&limit=12${unreadOnly ? '&unread=1' : ''}`)).data;
    setBell(unreadCount);
    root.innerHTML = `
    <div class="notif-bar">
      <div class="d-flex gap-2" role="group" aria-label="Filter">
        <button type="button" class="btn ${unreadOnly ? 'btn-ghost' : 'btn-brand'} btn-sm-brand" id="f-all" aria-pressed="${!unreadOnly}">All</button>
        <button type="button" class="btn ${unreadOnly ? 'btn-brand' : 'btn-ghost'} btn-sm-brand" id="f-unread" aria-pressed="${unreadOnly}">Unread (${esc(unreadCount)})</button>
      </div>
      <button type="button" class="btn btn-ghost btn-sm-brand" id="read-all" ${unreadCount ? '' : 'disabled'}>Mark all as read</button>
    </div>
    ${notifications.length ? `<ul class="notif-list">${notifications.map(item).join('')}</ul>` : stateBox(unreadOnly ? 'No unread notifications' : 'No notifications yet', 'Updates about your appointments, reports and payments show up here.')}
    ${pagination.pages > 1 ? `<nav class="pager mt-3" aria-label="Pages"><button class="btn btn-ghost" id="prev" ${page <= 1 ? 'disabled' : ''}>Previous</button><span>Page ${pagination.page} of ${pagination.pages}</span><button class="btn btn-ghost" id="next" ${page >= pagination.pages ? 'disabled' : ''}>Next</button></nav>` : ''}`;

    document.getElementById('f-all').addEventListener('click', () => { unreadOnly = false; page = 1; load(); });
    document.getElementById('f-unread').addEventListener('click', () => { unreadOnly = true; page = 1; load(); });
    document.getElementById('read-all').addEventListener('click', async () => { try { await api.patch('/notifications/read-all'); load(); } catch (e) { showToast(e.message, 'error'); } });
    document.getElementById('prev')?.addEventListener('click', () => { page -= 1; load(); });
    document.getElementById('next')?.addEventListener('click', () => { page += 1; load(); });
    root.querySelectorAll('[data-read]').forEach((b) => b.addEventListener('click', async () => { try { await api.patch(`/notifications/${encodeURIComponent(b.dataset.read)}/read`); load(); } catch (e) { showToast(e.message, 'error'); } }));
    root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => { try { await api.del(`/notifications/${encodeURIComponent(b.dataset.del)}`); load(); } catch (e) { showToast(e.message, 'error'); } }));
    root.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', async () => {
      try { await api.patch(`/notifications/${encodeURIComponent(b.dataset.open)}/read`); } catch (_) { /* still go to the page */ }
      const to = b.dataset.href || ''; if (to.startsWith('/') && !to.startsWith('//')) window.location.href = to;
    }));
  } catch (error) { root.innerHTML = stateBox('Could not load your notifications', error.message); }
}
load();
