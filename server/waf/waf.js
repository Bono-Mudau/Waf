import inspector from './inspector.js';
import normalizer from './normalizer.js';
import decisionEngine from './decisionEngine.js';
import { defaultRules } from '../db/defaultRules.js';
import { InspectionPool } from './inspectionPool.js';
import { createLogSender } from './logger.js';
import { redact } from './redactor.js';

export function mywaf(config = {}) {
  if (
    (config.mode !== undefined && typeof config.mode !== 'string') ||
    (config.strict !== undefined && typeof config.strict !== 'string')
  )
    throw new Error('WAF mode and strictness must be strings.');
  const mode =
    typeof config.mode === 'string' ? config.mode.toLowerCase() : 'local';
  const strict =
    typeof config.strict === 'string' ? config.strict.toLowerCase() : 'normal';
  if (!['local', 'hybrid'].includes(mode))
    throw new Error('WAF mode must be local or hybrid.');
  if (!['low', 'normal', 'high'].includes(strict))
    throw new Error('WAF strictness must be low, normal, or high.');
  if (
    mode === 'hybrid' &&
    !/^sqlishield_[a-f0-9]{64}$/.test(config.apiKey || '')
  )
    throw new Error('Hybrid mode requires a SQLiShield service API key.');
  const backendUrl = String(
    config.backendUrl || 'http://localhost:3000'
  ).replace(/\/$/, '');
  const url = new URL(backendUrl);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error(
      'backendUrl must be an HTTP(S) origin without credentials.'
    );
  if (
    mode === 'hybrid' &&
    url.protocol === 'http:' &&
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  )
    throw new Error('Use HTTPS for a remote hybrid backend.');
  const logger = config.logger || console;
  const pool = new InspectionPool({
    timeout: config.inspectionTimeoutMs || 100,
  });
  const sender =
    mode === 'hybrid'
      ? createLogSender({ backendUrl, apiKey: config.apiKey, logger })
      : null;
  let rules = mode === 'local' ? defaultRules : null;
  let serviceId = null;
  let lastWarning = 0;
  let closed = false;
  let refreshing;
  async function refresh() {
    if (mode === 'local') return;
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        const response = await fetch(`${backendUrl}/api/waf/config`, {
          headers: { 'X-API-Key': config.apiKey },
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) throw new Error('Could not load service rules.');
        const data = await response.json();
        if (
          !Array.isArray(data.rules) ||
          data.rules.length > 250 ||
          !data.service_id ||
          String(data.service_id) === '0'
        )
          throw new Error('Invalid service rule response.');
        for (const rule of data.rules) {
          if (
            typeof rule.pattern !== 'string' ||
            rule.pattern.length > 1000 ||
            !['keyword', 'regex'].includes(rule.match_type || rule.matchType) ||
            !Number.isFinite(Number(rule.score))
          )
            throw new Error('Invalid rule configuration.');
        }
        rules = data.rules;
        serviceId = data.service_id;
      } catch {
        if (Date.now() - lastWarning > 30000) {
          lastWarning = Date.now();
          logger.warn(
            rules
              ? 'SQLiShield could not refresh rules; using the last loaded service rules.'
              : 'SQLiShield service rules are unavailable; requests will receive 503 until initialization succeeds.'
          );
        }
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }
  const ready = mode === 'hybrid' ? refresh() : Promise.resolve();
  const timer =
    mode === 'hybrid'
      ? setInterval(() => {
          if (!closed) void refresh();
        }, 30000)
      : null;
  timer?.unref();
  async function middleware(req, res, next) {
    if (closed) return res.status(503).json({ error: 'WAF_UNAVAILABLE' });
    await ready;
    if (!rules) return res.status(503).json({ error: 'WAF_UNAVAILABLE' });
    try {
      const start = performance.now();
      const record = inspector.inspect(req);
      const normalized = normalizer.normalize(record);
      const detection = await pool.inspect(normalized, rules);
      const decision = decisionEngine.decide(detection.score, strict);
      const latency = performance.now() - start;
      const event = {
        requestID: record.requestID,
        timestamp: record.timestamp,
        ip: record.ip,
        method: record.method,
        path: record.path,
        score: detection.score,
        decision: decision.action,
        latency_ms: latency,
        strictness: strict,
      };
      if (decision.action === 'BLOCK')
        Object.assign(event, {
          matched_rules: detection.ruleMatches.slice(0, 50).map((match) => ({
            ...match.rule,
            source: match.source,
            key: match.key.slice(0, 200),
          })),
          indicators: detection.indicators
            .slice(0, 50)
            .map((item) => ({ ...item, key: item.key.slice(0, 200) })),
          payload: redact({
            headers: record.headers,
            query: record.query,
            body: record.body,
          }),
        });
      if (Buffer.byteLength(JSON.stringify(event)) > 30000) {
        event.payload = {
          notice: 'Request details omitted to keep telemetry bounded.',
        };
        event.matched_rules = event.matched_rules?.slice(0, 20);
        event.indicators = event.indicators?.slice(0, 20);
      }
      logger.log({ service_id: serviceId, ...redact(event) });
      sender?.enqueue(event);
      if (decision.action === 'BLOCK')
        return res
          .status(403)
          .json({ error: 'ERR_REQ_BLOCKED', requestID: record.requestID });
      return next();
    } catch (error) {
      logger.warn('SQLiShield inspection could not complete.');
      return res.status(error.status === 413 ? 413 : 503).json({
        error:
          error.status === 413 ? 'WAF_INSPECTION_LIMIT' : 'WAF_UNAVAILABLE',
      });
    }
  }
  middleware.ready = ready;
  middleware.refreshRules = refresh;
  middleware.flush = () => sender?.flush() || Promise.resolve();
  middleware.close = async () => {
    closed = true;
    if (timer) clearInterval(timer);
    await sender?.close();
    await pool.close();
  };
  return middleware;
}
