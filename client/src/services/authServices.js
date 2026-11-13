import { endpoints, request, ApiError } from './apiClient';

export function normalizeUser(data) {
  const user = data?.user ?? data;
  if (!user || typeof user !== 'object' || !user.email)
    throw new ApiError(
      'The session response does not contain a user. Check the API response format.'
    );
  return {
    ...user,
    full_name: user.full_name || user.fullName || user.name || '',
    role:
      String(user.role || '').toLowerCase() === 'developer'
        ? 'user'
        : String(user.role || '').toLowerCase(),
    service_id: user.service_id ?? user.serviceId ?? data?.service?.id,
    service: data?.service ?? user.service ?? null,
  };
}

export async function getSession(options = {}) {
  return normalizeUser(
    await request(endpoints.session, { notifyUnauthorized: false, ...options })
  );
}
export async function login(credentials) {
  // The server establishes an HttpOnly cookie. A successful redirect alone is not authentication.
  await request(endpoints.login, {
    method: 'POST',
    body: credentials,
    notifyUnauthorized: false,
  });
  return getSession();
}
export const logout = () => request(endpoints.logout, { method: 'POST' });
export const registerService = (body) =>
  request(endpoints.registerService, {
    method: 'POST',
    body,
    notifyUnauthorized: false,
  });
export const forgotPassword = (email) =>
  request(endpoints.forgotPassword, {
    method: 'POST',
    body: { email },
    notifyUnauthorized: false,
  });
export const resetPassword = (body) =>
  request(endpoints.resetPassword, {
    method: 'POST',
    body,
    notifyUnauthorized: false,
  });
export const changePassword = (body) =>
  request(endpoints.changePassword, { method: 'PATCH', body });

export const passwordIsValid = (password) =>
  password.length >= 8 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /\d/.test(password);
export const emailIsValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const passwordHint =
  'Use at least 8 characters, with an uppercase letter, a lowercase letter, and a number.';
