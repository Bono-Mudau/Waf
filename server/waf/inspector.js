import { randomUUID } from 'node:crypto';
const hidden = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
]);
export class InspectionLimitError extends Error {
  constructor() {
    super('Request exceeds SQLiShield inspection limits.');
    this.status = 413;
  }
}
function check(value, depth, budget) {
  if (depth > 12 || --budget.remaining < 0) throw new InspectionLimitError();
  if (typeof value === 'string' && value.length > 16384)
    throw new InspectionLimitError();
  if (value && typeof value === 'object')
    for (const [key, item] of Object.entries(value)) {
      if (key.length > 1000) throw new InspectionLimitError();
      check(item, depth + 1, budget);
    }
}
class Inspector {
  inspect(req) {
    const headers = Object.fromEntries(
      Object.entries(req.headers || {}).filter(
        ([key]) => !hidden.has(key.toLowerCase())
      )
    );
    const record = {
      requestID: randomUUID(),
      method: req.method,
      path: req.path || '/',
      headers,
      body: req.body ?? {},
      query: req.query ?? {},
      ip: req.ip ?? req.socket?.remoteAddress ?? null,
      timestamp: new Date().toISOString(),
    };
    if (record.path.length > 2048) throw new InspectionLimitError();
    check(
      { path: record.path, headers, body: record.body, query: record.query },
      0,
      { remaining: 1000 }
    );
    return record;
  }
}
export default new Inspector();
