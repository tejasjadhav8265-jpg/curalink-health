import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { mountLayout } from '../components/layout.js';
import { openModal } from '../components/modal.js';
import { confirmModal } from '../components/confirm-modal.js';
import { esc, stateBox, setLoading, setFieldError, showNotice } from '../core/ui.js';
import { showToast } from '../core/toast.js';

const user = await requireRole('admin');
mountLayout({ user, active: 'departments' });
const root = document.getElementById('root');

async function load() {
  try {
    const { departments } = (await api.get('/admin/departments')).data;
    if (!departments.length) { root.innerHTML = stateBox('No departments yet', 'Add the first department with the button above.'); return; }
    root.innerHTML = `<div class="dept-grid">${departments.map((d) => `<article class="dept-card${d.status === 'inactive' ? ' off' : ''}">
      <div class="d-flex justify-content-between align-items-start"><span class="ico"><i class="fa-solid ${esc(d.icon || 'fa-stethoscope')}" aria-hidden="true"></i></span><span class="st st-${d.status === 'active' ? 'active' : 'inactive'}">${d.status === 'active' ? 'Active' : 'Inactive'}</span></div>
      <h2>${esc(d.name)}</h2><p>${esc(d.description || 'No description yet.')}</p>
      <span class="when">${esc(d.doctors)} ${d.doctors === 1 ? 'doctor' : 'doctors'} (${esc(d.activeDoctors)} active)</span>
      <div class="actions d-flex gap-2"><button type="button" class="btn btn-ghost btn-sm-brand" data-edit="${esc(d._id)}">Edit</button><button type="button" class="btn btn-danger-ghost" data-del="${esc(d._id)}" data-name="${esc(d.name)}">Delete</button></div></article>`).join('')}</div>`;
    const byId = new Map(departments.map((d) => [d._id, d]));
    root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => form(byId.get(b.dataset.edit))));
    root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => remove(b.dataset)));
  } catch (error) { root.innerHTML = stateBox('Could not load departments', error.message); }
}

function form(dept) {
  const editing = Boolean(dept);
  const m = openModal({
    title: editing ? 'Edit department' : 'Add department',
    bodyHtml: `<form id="dept-form" novalidate><div id="dept-notice" tabindex="-1"></div>
      <div class="field"><label for="name">Name</label><input class="form-control" id="name" maxlength="60"><div class="field-error" id="name-error" hidden></div></div>
      <div class="field"><label for="description">Description <span class="optional">(optional)</span></label><textarea class="form-control" id="description" rows="3" maxlength="1000"></textarea><div class="field-error" id="description-error" hidden></div></div>
      <div class="field"><label for="icon">Icon <span class="optional">(optional)</span></label><input class="form-control" id="icon" maxlength="45" placeholder="fa-heart-pulse"><div class="help">A Font Awesome name such as fa-heart-pulse or fa-brain. Default is fa-stethoscope.</div><div class="field-error" id="icon-error" hidden></div></div>
      <div class="field mb-0"><label for="status">Status</label><select class="form-select" id="status"><option value="active">Active (shown on the website)</option><option value="inactive">Inactive (hidden)</option></select><div class="field-error" id="status-error" hidden></div></div></form>`,
    footerHtml: '<button type="button" class="btn btn-ghost" data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-brand" id="dept-save">Save</button>',
  });
  const $ = (id) => m.el.querySelector(`#${id}`);
  $('name').value = editing ? dept.name : '';
  $('description').value = editing ? dept.description || '' : '';
  $('icon').value = editing ? dept.icon || '' : '';
  $('status').value = editing ? dept.status : 'active';
  const save = async () => {
    ['name', 'description', 'icon', 'status'].forEach((n) => setFieldError($(n), ''));
    const body = { name: $('name').value.trim(), description: $('description').value.trim(), icon: $('icon').value.trim(), status: $('status').value };
    const button = $('dept-save');
    setLoading(button, true, 'Saving...');
    try {
      const res = editing ? await api.put(`/admin/departments/${encodeURIComponent(dept._id)}`, body) : await api.post('/admin/departments', body);
      showToast(res.message, 'success');
      m.close();
      load();
    } catch (error) {
      setLoading(button, false);
      (error.errors || []).forEach((e) => setFieldError($(e.field), e.message));
      showNotice($('dept-notice'), (error.errors && error.errors[0] && error.errors[0].message) || error.message, 'error');
    }
  };
  $('dept-save').addEventListener('click', save);
  $('dept-form').addEventListener('submit', (e) => { e.preventDefault(); save(); });
  m.el.addEventListener('shown.bs.modal', () => $('name').focus());
}

function remove({ del: id, name }) {
  confirmModal({
    title: `Delete ${name}?`, message: 'This cannot be undone. A department that still has doctors cannot be deleted; mark it inactive instead.', confirmLabel: 'Yes, delete',
    onConfirm: async () => { const res = await api.del(`/admin/departments/${id}`); showToast(res.message, 'success'); load(); },
  });
}

document.getElementById('add-dept').addEventListener('click', () => form(null));
load();
