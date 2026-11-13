// Adapt these paths to your backend in one place. See README.md for the contract.
export const endpoints = {
  registerService: '/auth/register-service',
  login: '/auth/login',
  logout: '/auth/logout',
  session: '/auth/me',
  forgotPassword: '/auth/forgot-password',
  resetPassword: '/auth/reset-password',
  profile: '/users/me',
  changePassword: '/users/me/password',
  users: '/users',
  rules: '/rules',
  service: '/services/current',
  summary: '/dashboard/summary',
  logs: '/logs',
};

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || '/api'
).replace(/\/$/, '');
export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  new URL(API_BASE_URL, window.location.origin).origin;

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function request(
  path,
  { method = 'GET', body, signal, notifyUnauthorized = true } = {}
) {
  const timeout = AbortSignal.timeout(12000);
  const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: combinedSignal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(
      timeout.aborted
        ? 'The server took too long to respond. Please try again.'
        : 'Cannot connect to SQLiShield. Check that your API server is running and try again.'
    );
  }
  if (response.status === 401 && notifyUnauthorized)
    window.dispatchEvent(new Event('sqlishield:unauthorized'));
  const isJson = response.headers.get('content-type')?.includes('json');
  let payload = null;
  if (isJson && response.status !== 204) {
    try {
      payload = await response.json();
    } catch {
      throw new ApiError(
        'The server returned an unreadable response.',
        response.status
      );
    }
  }
  if (!response.ok || payload?.success === false) {
    const suppliedMessage =
      payload?.message ||
      (typeof payload?.error === 'string' ? payload.error : null);
    throw new ApiError(
      suppliedMessage ||
        {
          401: 'Your session has expired. Please sign in again.',
          403: 'You do not have permission to perform this action.',
          404: 'This API endpoint is unavailable. Check the backend route configuration.',
          409: 'This change conflicts with an existing record.',
          429: 'Too many requests. Please wait a moment before trying again.',
        }[response.status] ||
        'The request could not be completed. Please try again.',
      response.status
    );
  }
  if (!isJson && response.status !== 204)
    throw new ApiError(
      'Expected JSON from the API. Check the API base URL and backend routes.',
      response.status
    );
  return payload?.data ?? payload;
}

export function readList(data, key) {
  const list = Array.isArray(data) ? data : (data?.[key] ?? data?.items);
  if (!Array.isArray(list))
    throw new ApiError(`The API response must contain a ${key} array.`);
  return list;
}
