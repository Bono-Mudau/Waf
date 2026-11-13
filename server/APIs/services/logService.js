import { isIP } from 'node:net';
import { transaction } from '../../db/dbConfig.js';
import { requireThat } from '../middleware/errors.js';
import { redact } from '../../waf/redactor.js';

export function validateEvent(body) {
  requireThat(
    body && typeof body === 'object' && !Array.isArray(body),
    'A log object is required.'
  );
  const allowed = [
    'requestID',
    'timestamp',
    'ip',
    'method',
    'path',
    'score',
    'decision',
    'latency_ms',
    'strictness',
    'matched_rules',
    'indicators',
    'payload',
  ];
  requireThat(
    Object.keys(body).every((key) => allowed.includes(key)),
    'Log contains unsupported fields.'
  );
  requireThat(
    typeof body.requestID === 'string' &&
      /^[A-Za-z0-9_-]{1,100}$/.test(body.requestID),
    'A valid requestID is required.'
  );
  requireThat(
    typeof body.method === 'string' && /^[A-Z]{1,10}$/.test(body.method),
    'Invalid HTTP method.'
  );
  requireThat(
    typeof body.path === 'string' &&
      body.path.startsWith('/') &&
      body.path.length <= 2048,
    'Invalid request path.'
  );
  requireThat(
    body.ip === null ||
      body.ip === undefined ||
      (typeof body.ip === 'string' && isIP(body.ip) > 0),
    'Invalid IP address.'
  );
  requireThat(
    Number.isFinite(body.score) && body.score >= 0 && body.score <= 1000000,
    'Invalid detection score.'
  );
  requireThat(
    Number.isFinite(body.latency_ms) &&
      body.latency_ms >= 0 &&
      body.latency_ms <= 60000,
    'Invalid inspection latency.'
  );
  requireThat(
    ['BLOCK', 'ALLOW'].includes(body.decision),
    'Decision must be BLOCK or ALLOW.'
  );
  requireThat(
    ['low', 'normal', 'high'].includes(body.strictness),
    'Invalid strictness.'
  );
  requireThat(
    typeof body.timestamp === 'string' &&
      Number.isFinite(Date.parse(body.timestamp)),
    'Invalid timestamp.'
  );
  for (const field of ['matched_rules', 'indicators'])
    requireThat(
      body[field] === undefined ||
        (Array.isArray(body[field]) &&
          body[field].length <= 100 &&
          body[field].every(
            (item) => item && typeof item === 'object' && !Array.isArray(item)
          )),
      `${field} must be an array of metadata objects.`
    );
  requireThat(
    body.payload === undefined ||
      (body.payload &&
        typeof body.payload === 'object' &&
        !Array.isArray(body.payload)),
    'Payload must be an object.'
  );
  const matched_rules = Array.isArray(body.matched_rules)
    ? body.matched_rules.slice(0, 100).map((rule) => ({
        id: rule.id,
        name: String(rule.name || '').slice(0, 150),
        source: String(rule.source || '').slice(0, 30),
        key: String(rule.key || '').slice(0, 200),
      }))
    : [];
  const indicators = Array.isArray(body.indicators)
    ? body.indicators.slice(0, 100).map((item) => ({
        type: String(item.type || '').slice(0, 50),
        source: String(item.source || '').slice(0, 30),
        key: String(item.key || '').slice(0, 200),
      }))
    : [];
  const payload = redact(body.payload || {});
  requireThat(
    Buffer.byteLength(JSON.stringify(payload)) <= 24000,
    'Request payload details are too large.'
  );
  return { ...body, payload, matched_rules, indicators };
}
export function presentLog(row) {
  return {
    id: row.id,
    requestID: row.request_id,
    service_id: row.service_id,
    timestamp: row.created_at,
    ip: row.ip_address,
    method: row.method,
    path: row.path,
    score: Number(row.threat_score),
    decision: 'BLOCK',
    strictness: row.strictness,
    matched_rules: row.matched_rules,
    indicators: row.indicators,
    payload: row.request_payload,
  };
}
export function createLogService(pool) {
  return {
    async ingest(serviceId, event) {
      return transaction(pool, async (client) => {
        const receipt = await client.query(
          'INSERT INTO request_receipts(service_id,request_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING request_id',
          [serviceId, event.requestID]
        );
        if (!receipt.rowCount) return null;
        await client.query(
          'INSERT INTO service_metrics(service_id,total_inspected,total_blocked,total_latency_ms) VALUES($1,1,$2,$3) ON CONFLICT(service_id) DO UPDATE SET total_inspected=service_metrics.total_inspected+1,total_blocked=service_metrics.total_blocked+EXCLUDED.total_blocked,total_latency_ms=service_metrics.total_latency_ms+EXCLUDED.total_latency_ms,updated_at=NOW()',
          [serviceId, event.decision === 'BLOCK' ? 1 : 0, event.latency_ms]
        );
        if (event.decision !== 'BLOCK') return null;
        const result = await client.query(
          "INSERT INTO incident_logs(service_id,request_id,ip_address,method,path,threat_score,strictness,matched_rules,indicators,decision,request_payload,latency_ms,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'block',$10,$11,$12) RETURNING *",
          [
            serviceId,
            event.requestID,
            event.ip || null,
            event.method,
            event.path,
            event.score,
            event.strictness,
            JSON.stringify(event.matched_rules),
            JSON.stringify(event.indicators),
            JSON.stringify(event.payload),
            event.latency_ms,
            new Date(event.timestamp),
          ]
        );
        return presentLog(result.rows[0]);
      });
    },
    async list(serviceId, limit) {
      return (
        await pool.query(
          'SELECT * FROM incident_logs WHERE service_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2',
          [serviceId, limit]
        )
      ).rows.map(presentLog);
    },
    async summary(serviceId) {
      const metrics = (
        await pool.query(
          'SELECT total_inspected,total_blocked,total_latency_ms FROM service_metrics WHERE service_id=$1',
          [serviceId]
        )
      ).rows[0];
      const count = (
        await pool.query(
          'SELECT COUNT(*) FROM rules WHERE enabled=TRUE AND (service_id=0 OR service_id=$1)',
          [serviceId]
        )
      ).rows[0].count;
      return {
        total_inspected: Number(metrics?.total_inspected || 0),
        total_blocked: Number(metrics?.total_blocked || 0),
        average_latency_ms:
          Number(metrics?.total_inspected) > 0
            ? Math.round(
                (Number(metrics.total_latency_ms) /
                  Number(metrics.total_inspected)) *
                  1000
              ) / 1000
            : null,
        active_rules: Number(count),
        period_label:
          'Telemetry received since service registration. Local-only requests and undelivered events are excluded.',
      };
    },
  };
}
