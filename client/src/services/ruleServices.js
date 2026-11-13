import { endpoints, request, readList } from './apiClient';

export function normalizeRule(rule) {
  const enabled =
    rule.enabled ?? rule.is_enabled ?? rule.is_active ?? rule.status;
  return {
    ...rule,
    name: rule.name ?? rule.rule_name ?? rule.pattern ?? 'Unnamed rule',
    match_type: rule.match_type ?? rule.matchType ?? 'keyword',
    score: rule.score ?? rule.points ?? rule.point ?? 0,
    enabled:
      enabled === true ||
      enabled === 1 ||
      enabled === 'enabled' ||
      enabled === 'true',
    isDefault:
      rule.is_default === true ||
      rule.service_id === 0 ||
      rule.service_id === '0',
  };
}
export async function listRules(options) {
  return readList(await request(endpoints.rules, options), 'rules').map(
    normalizeRule
  );
}
export const createRule = (body) =>
  request(endpoints.rules, { method: 'POST', body });
export const updateRule = (id, body) =>
  request(`${endpoints.rules}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
  });
export const deleteRule = (id) =>
  request(`${endpoints.rules}/${encodeURIComponent(id)}`, { method: 'DELETE' });
