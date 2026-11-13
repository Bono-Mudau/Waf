import { requireThat } from '../middleware/errors.js';

export const validEmail = (value) =>
  typeof value === 'string' &&
  value.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
export const validPassword = (value) =>
  typeof value === 'string' &&
  value.length >= 8 &&
  Buffer.byteLength(value, 'utf8') <= 72 &&
  /[A-Z]/.test(value) &&
  /[a-z]/.test(value) &&
  /\d/.test(value);
export const normalizeRole = (role) => (role === 'developer' ? 'user' : role);
export const validRole = (role) =>
  ['admin', 'user', 'guest'].includes(normalizeRole(role));
export const validNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;
export const validNonEmptyStrings = (value) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.values(value).length > 0 &&
  Object.values(value).every(validNonEmptyString);
export const id = (value) => {
  requireThat(
    typeof value === 'string' && /^[1-9]\d{0,17}$/.test(value),
    'Invalid record ID.'
  );
  return value;
};
export const text = (value, label, max = 150) => {
  requireThat(
    validNonEmptyString(value) && value.trim().length <= max,
    `${label} is required and must be at most ${max} characters.`
  );
  return value.trim();
};
export const email = (value) => {
  requireThat(validEmail(value), 'Enter a valid email address.');
  return value.trim().toLowerCase();
};
export const password = (value) => {
  requireThat(
    validPassword(value),
    'Password must have at least 8 characters, uppercase and lowercase letters and a number, and at most 72 UTF-8 bytes.'
  );
  return value;
};
export const role = (value) => {
  requireThat(
    validRole(value),
    'Role must be admin, user (Developer), or guest.'
  );
  return normalizeRole(value);
};
export function onlyFields(body, allowed) {
  requireThat(
    body && typeof body === 'object' && !Array.isArray(body),
    'A JSON object is required.'
  );
  requireThat(
    Object.keys(body).every((key) => allowed.includes(key)),
    'Request contains unsupported fields.'
  );
}
