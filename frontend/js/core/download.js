import { showToast } from './toast.js';

// Downloads a protected file (PDF or report) with the logged-in cookie, and shows a friendly message if it fails.
export async function downloadFile(url, fileName) {
  try {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) {
      let message = 'The file could not be downloaded.';
      try { message = (await response.json()).message || message; } catch (_) { /* not JSON */ }
      showToast(message, 'error');
      return;
    }
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  } catch (_) {
    showToast('Cannot reach the server. Please try again.', 'error');
  }
}
