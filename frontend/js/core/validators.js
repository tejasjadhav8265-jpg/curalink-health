// Frontend validation. The backend repeats every check (never trust the browser alone).
// Each rule returns an error message, or '' when the value is fine.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[6-9]\d{9}$/;

export const passwordChecks = (pw) => ({
  length: pw.length >= 8,
  lower: /[a-z]/.test(pw),
  upper: /[A-Z]/.test(pw),
  number: /\d/.test(pw),
});

export const passwordScore = (pw) => Object.values(passwordChecks(pw)).filter(Boolean).length; // 0 to 4

export const rules = {
  required: (value, message) => (String(value || '').trim() ? '' : message),

  email(value) {
    const v = String(value || '').trim();
    if (!v) return 'Please enter your email.';
    return EMAIL_RE.test(v) ? '' : 'Please enter a valid email address.';
  },

  mobile(value, emptyMessage = 'Please enter your mobile number.') {
    const v = String(value || '').trim();
    if (!v) return emptyMessage;
    return MOBILE_RE.test(v) ? '' : 'Please enter a valid mobile number.';
  },

  password(value) {
    const v = String(value || '');
    if (!v) return 'Please enter a password.';
    if (v.length < 8) return 'Password must contain at least 8 characters.';
    if (v.length > 72) return 'Password must be 72 characters or fewer.';
    if (!/[a-z]/.test(v)) return 'Password must include a lowercase letter.';
    if (!/[A-Z]/.test(v)) return 'Password must include an uppercase letter.';
    if (!/\d/.test(v)) return 'Password must include a number.';
    return '';
  },

  confirm: (value, original) => (value === original ? '' : 'Passwords do not match.'),

  dob(value) {
    if (!value) return 'Please enter your date of birth.';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Please enter a valid date of birth.';
    const now = new Date();
    if (date > now) return 'Date of birth cannot be in the future.';
    if (now.getFullYear() - date.getFullYear() > 120) return 'Please enter a valid date of birth.';
    return '';
  },
};
