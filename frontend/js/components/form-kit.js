import { esc, setFieldError, showNotice } from '../core/ui.js';

// Small helpers so each page's form is a few lines. Every input id equals the server field name,
// so server messages like { field: 'phone', message: '...' } land under the right box.
export function inputHtml(id, label, { type = 'text', required = true, max = 100, hint = '', attrs = '' } = {}) {
  return `<div class="field"><label for="${id}">${esc(label)}${required ? '' : ' <span class="optional">(optional)</span>'}</label>
    <input class="form-control" id="${id}" name="${id}" type="${type}" maxlength="${max}" ${attrs}>
    ${hint ? `<div class="help">${esc(hint)}</div>` : ''}<div class="field-error" id="${id}-error" hidden></div></div>`;
}
export function textareaHtml(id, label, { required = true, max = 1000, rows = 4, hint = '' } = {}) {
  return `<div class="field"><label for="${id}">${esc(label)}${required ? '' : ' <span class="optional">(optional)</span>'}</label>
    <textarea class="form-control" id="${id}" name="${id}" rows="${rows}" maxlength="${max}"></textarea>
    ${hint ? `<div class="help">${esc(hint)}</div>` : ''}<div class="field-error" id="${id}-error" hidden></div></div>`;
}
export function selectHtml(id, label, options, { required = true, placeholder = 'Choose one' } = {}) {
  return `<div class="field"><label for="${id}">${esc(label)}${required ? '' : ' <span class="optional">(optional)</span>'}</label>
    <select class="form-select" id="${id}" name="${id}"><option value="">${esc(placeholder)}</option>${options.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>
    <div class="field-error" id="${id}-error" hidden></div></div>`;
}

export const clearErrors = (form) => form.querySelectorAll('.is-invalid').forEach((el) => setFieldError(el, ''));

// Puts server messages under their fields and the first one in the notice box. Returns the first bad field.
export function showServerErrors(form, noticeBox, error) {
  let first = null;
  (error.errors || []).forEach((e) => { const el = form.elements[e.field]; if (el && el.id) { setFieldError(el, e.message); first = first || el; } });
  showNotice(noticeBox, (error.errors && error.errors[0] && error.errors[0].message) || error.message, 'error');
  (first || noticeBox).focus();
  return first;
}
