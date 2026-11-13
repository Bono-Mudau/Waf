import test from 'node:test';
import assert from 'node:assert/strict';
import inspector from '../waf/inspector.js';
import normalizer from '../waf/normalizer.js';
import detection from '../waf/detectionEngine.js';
import heuristic from '../waf/heuristicEngine.js';
import decision from '../waf/decisionEngine.js';
import { defaultRules } from '../db/defaultRules.js';
import { redact } from '../waf/redactor.js';
import { InspectionPool } from '../waf/inspectionPool.js';
import { mywaf } from '../waf/waf.js';
import { loadConfig } from '../APIs/config.js';

test('normalisation handles encoding, Unicode, nested arrays, malformed escapes and prototype names without mutating input', () => {
  const input = JSON.parse(
    '{"__proto__":{"x":"%2555NION  SELECT"},"items":["ＡＢＣ",3]}'
  );
  const out = normalizer.normalizeValue(input);
  assert.equal(out.__proto__.x, 'union select');
  assert.equal(out.items[0], 'abc');
  assert.equal(input.items[0], 'ＡＢＣ');
  assert.equal({}.x, undefined);
  assert.equal(normalizer.normalizeString('%invalid'), ' %invalid'.trim());
});
test('detector blocks representative SQLi while leaving ordinary input below normal threshold', () => {
  const examples = [
    '1 OR 1=1--',
    'UNION SELECT NULL',
    "'; DROP TABLE users;--",
    'pg_sleep(5)',
  ];
  for (const value of examples) {
    const result = detection.detect(
      normalizer.normalize({
        path: '/search',
        query: { q: value },
        body: {},
        headers: {},
      }),
      defaultRules
    );
    assert.equal(
      decision.decide(result.score, 'normal').action,
      'BLOCK',
      value
    );
  }
  for (const value of [
    'hello world',
    'dropdown menu',
    '2026-10-29',
    'C# programming',
    'https://example.com',
  ])
    assert.equal(
      decision.decide(
        detection.detect({ query: { q: value } }, defaultRules).score,
        'normal'
      ).action,
      'ALLOW',
      value
    );
  assert.equal(heuristic.detectTautology('or 1=2'), false);
  assert.equal(heuristic.detectTautology('or 1=1'), true);
  assert.equal(heuristic.detectTimeBased('sleep(5)'), true);
});
test('inspection includes ordinary headers and never exposes credentials in the inspection header set', () => {
  const record = inspector.inspect({
    method: 'GET',
    path: '/',
    headers: {
      authorization: 'private',
      cookie: 'private',
      'x-test': 'UNION SELECT',
    },
    body: { password: 'private' },
  });
  assert.equal(record.headers.authorization, undefined);
  assert.equal(record.headers.cookie, undefined);
  const result = detection.detect(normalizer.normalize(record), defaultRules);
  assert.ok(result.ruleMatches.some((match) => match.source === 'headers'));
  assert.equal(redact(record).body.password, '[REDACTED]');
  assert.ok(!JSON.stringify(result).includes('private'));
});
test('strictness thresholds and configuration casing are consistent', async () => {
  for (const [strict, threshold] of [
    ['low', 40],
    ['normal', 25],
    ['high', 15],
  ]) {
    assert.equal(
      decision.decide(threshold, strict.toUpperCase()).action,
      'BLOCK'
    );
    assert.equal(decision.decide(threshold - 0.1, strict).action, 'ALLOW');
  }
  const waf = mywaf({ mode: 'LOCAL', strict: 'HIGH' });
  await waf.close();
  assert.throws(() => mywaf({ mode: 'hybrid' }));
  assert.throws(() => mywaf({ mode: 42 }));
  assert.throws(() => loadConfig({ JWT_SECRET: 'short' }));
});
test('oversized or deeply nested requests are rejected rather than inspected partially', () => {
  assert.throws(
    () => inspector.inspect({ body: { text: 'a'.repeat(17000) } }),
    (error) => error.status === 413
  );
  let deep = {};
  for (let i = 0; i < 20; i++) deep = { next: deep };
  assert.throws(
    () => inspector.inspect({ body: deep }),
    (error) => error.status === 413
  );
});
test('a pathological regex is bounded outside the event loop and the worker recovers', async () => {
  const pool = new InspectionPool({ timeout: 100 });
  try {
    let timerRan = false;
    const timer = setTimeout(() => {
      timerRan = true;
    }, 20);
    await assert.rejects(
      pool.inspect({ body: { text: `${'a'.repeat(8000)}!` } }, [
        {
          id: 1,
          name: 'Slow',
          pattern: '^(a+)+$',
          match_type: 'regex',
          score: 1,
          enabled: true,
        },
      ]),
      /time limit/
    );
    clearTimeout(timer);
    assert.equal(timerRan, true);
    const result = await pool.inspect({ query: { q: 'hello' } }, defaultRules);
    assert.equal(result.score, 0);
  } finally {
    await pool.close();
  }
});
