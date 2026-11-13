import { endpoints, request, readList } from './apiClient';

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrator' },
  { value: 'user', label: 'Developer' },
  { value: 'guest', label: 'Guest' },
];
export const roleLabel = (role) =>
  ROLE_OPTIONS.find((option) => option.value === String(role).toLowerCase())
    ?.label ||
  role ||
  'Unknown';

export function normalizeUserRecord(user) {
  const role = String(user.role || '').toLowerCase();
  return {
    ...user,
    full_name: user.full_name || user.fullName || user.name || '',
    role: role === 'developer' ? 'user' : role,
  };
}
export async function listUsers(options) {
  return readList(await request(endpoints.users, options), 'users').map(
    normalizeUserRecord
  );
}
export const createUser = (body) =>
  request(endpoints.users, { method: 'POST', body });
export const updateUser = (id, body) =>
  request(`${endpoints.users}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
  });
export const updateRole = (id, role) =>
  request(`${endpoints.users}/${encodeURIComponent(id)}/role`, {
    method: 'PATCH',
    body: { role },
  });
export const deleteUser = (id) =>
  request(`${endpoints.users}/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const updateProfile = (body) =>
  request(endpoints.profile, { method: 'PATCH', body });
export const deleteProfile = () =>
  request(endpoints.profile, { method: 'DELETE' });
