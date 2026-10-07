// Small pop-up messages ("toasts"). Usage: showToast('Saved.', 'success')
let region;

function getRegion() {
  if (!region) {
    region = document.createElement('div');
    region.id = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'false');
    document.body.appendChild(region);
  }
  return region;
}

export function showToast(message, type = 'info', duration = 4500) {
  const item = document.createElement('div');
  item.className = `toast-item ${type}`;
  item.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const text = document.createElement('span');
  text.textContent = message; // textContent (not innerHTML) keeps this XSS-safe
  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss message');
  close.textContent = '\u00D7';

  const remove = () => item.remove();
  close.addEventListener('click', remove);
  item.append(text, close);
  getRegion().appendChild(item);
  if (duration) setTimeout(remove, duration);
}
