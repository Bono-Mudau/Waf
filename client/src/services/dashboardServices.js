import { endpoints, request, readList } from './apiClient';

export const getSummary = (options) => request(endpoints.summary, options);
export const getService = async (options) => {
  const data = await request(endpoints.service, options);
  return data?.service ?? data;
};
export const updateService = (body) =>
  request(endpoints.service, { method: 'PATCH', body });

export const createServiceKey = (rotate = false) =>
  request(`${endpoints.service}/api-keys`, {
    method: 'POST',
    body: { rotate },
  });
export const revokeServiceKey = (id) =>
  request(`${endpoints.service}/api-keys/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

export function redactPayload(value, depth = 0) {
  if (depth > 8) return '[Nested data omitted]';
  if (Array.isArray(value))
    return value.slice(0, 100).map((item) => redactPayload(item, depth + 1));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([key, item]) => [
          key,
          /password|passwd|token|authorization|cookie|api[-_]?key|secret/i.test(
            key
          )
            ? '[REDACTED]'
            : redactPayload(item, depth + 1),
        ])
    );
  return typeof value === 'string' && value.length > 8000
    ? `${value.slice(0, 8000)}…`
    : value;
}
export function normalizeLog(event) {
  const item = event?.log ?? event;
  const decision = String(item?.decision ?? item?.action ?? '').toUpperCase();
  const timestamp = item?.timestamp ?? item?.created_at ?? '';
  const ip = item?.ipAddress ?? item?.ip_address ?? item?.ip ?? 'Unknown';
  const path = item?.path ?? item?.route ?? '—';
  return {
    id:
      item?.requestID ??
      item?.requestId ??
      item?.id ??
      `${timestamp}|${ip}|${item?.method}|${path}`,
    timestamp,
    ip,
    path,
    method: item?.method ?? '—',
    decision: decision.startsWith('BLOCK')
      ? 'BLOCK'
      : decision.startsWith('ALLOW')
        ? 'ALLOW'
        : 'UNKNOWN',
    attackType: item?.attackType ?? item?.attack_type ?? 'Unclassified',
    score: item?.score ?? item?.detection?.score ?? null,
    service_id: item?.service_id ?? item?.serviceId,
    details: redactPayload(item),
  };
}
export async function listLogs(options) {
  const data = await request(`${endpoints.logs}?limit=200`, options);
  return readList(data, 'logs').map(normalizeLog);
}
export function mergeLogs(live, saved) {
  const unique = new Map();
  [...live, ...saved].forEach((log) => {
    if (!unique.has(String(log.id))) unique.set(String(log.id), log);
  });
  return [...unique.values()].sort(
    (a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0)
  );
}
export function formatTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unavailable'
    : date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium',
      });
}
