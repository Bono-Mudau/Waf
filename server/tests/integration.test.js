import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { io } from 'socket.io-client';
import { testDatabase } from './database.js';
import { migrate } from '../db/migrate.js';
import { createApplication } from '../server.js';
import { loadConfig } from '../APIs/config.js';
import { mywaf } from '../waf/waf.js';
import { frontendClient } from './frontend-client.js';

const origin = 'http://localhost:5173';
const password = 'TestOnly123!';
async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}
async function closeHttp(server) {
  server.closeIdleConnections();
  await new Promise((resolve) => server.close(resolve));
}

test(
  'database-backed API, WAF, sessions, tenants, sockets, and recovery',
  { timeout: 90000 },
  async (t) => {
    const database = await testDatabase();
    const pool = database.pool;
    const mail = [];
    const config = {
      ...loadConfig({
        JWT_SECRET: randomBytes(48).toString('hex'),
        FRONTEND_URL: origin,
      }),
      hashRounds: 10,
    };
    let application;
    const sockets = [];
    const protectedApps = [];
    try {
      await migrate(pool);
      await migrate(pool);
      application = createApplication({
        pool,
        config,
        sendResetMail: (message) => mail.push(message),
        rateLimits: false,
      });
      const base = await listen(application.httpServer);
      async function request(
        path,
        { method = 'GET', body, cookie, apiKey, requestOrigin = origin } = {}
      ) {
        const response = await fetch(`${base}/api${path}`, {
          method,
          headers: {
            ...(requestOrigin ? { Origin: requestOrigin } : {}),
            ...(cookie ? { Cookie: cookie } : {}),
            ...(apiKey ? { 'X-API-Key': apiKey } : {}),
            ...(body !== undefined
              ? { 'Content-Type': 'application/json' }
              : {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        const json = await response.json();
        return {
          status: response.status,
          json,
          cookie: response.headers.get('set-cookie')?.split(';')[0],
          headers: response.headers,
        };
      }
      async function register(name, email) {
        const result = await request('/auth/register-service', {
          method: 'POST',
          body: {
            service_name: name,
            full_name: name + ' Administrator',
            email,
            password,
          },
        });
        assert.equal(result.status, 201, JSON.stringify(result.json));
        return result.json;
      }
      async function login(email, pw = password) {
        const result = await request('/auth/login', {
          method: 'POST',
          body: { email, password: pw },
        });
        assert.equal(result.status, 200, JSON.stringify(result.json));
        assert.ok(result.cookie);
        assert.equal(result.json.token, undefined);
        return result.cookie;
      }
      async function connect(cookie) {
        const socket = io(base, {
          transports: ['websocket'],
          reconnection: false,
          extraHeaders: { Cookie: cookie, Origin: origin },
          timeout: 3000,
        });
        sockets.push(socket);
        await Promise.race([
          once(socket, 'connect'),
          once(socket, 'connect_error').then(([error]) => {
            throw error;
          }),
        ]);
        return socket;
      }
      const a = await register('Service A', 'admin-a@example.test');
      const b = await register('Service B', 'admin-b@example.test');
      let cookieA = await login('admin-a@example.test');
      let cookieB = await login('admin-b@example.test');
      let keyA, keyB, ruleA, member;
      await t.test(
        'registration is atomic and session data is safe',
        async () => {
          assert.equal(a.user.role, 'admin');
          assert.equal(String(a.user.service_id), String(a.service.id));
          const count = Number(
            (await pool.query('SELECT count(*) FROM services')).rows[0].count
          );
          assert.equal(
            (
              await request('/auth/register-service', {
                method: 'POST',
                body: {
                  service_name: 'Must roll back',
                  full_name: 'Duplicate',
                  email: 'ADMIN-A@EXAMPLE.TEST',
                  password,
                },
              })
            ).status,
            409
          );
          assert.equal(
            Number(
              (await pool.query('SELECT count(*) FROM services')).rows[0].count
            ),
            count
          );
          assert.equal(
            (
              await request('/auth/register-service', {
                method: 'POST',
                body: {
                  service_name: 'Forged',
                  full_name: 'Forged',
                  email: 'forge@example.test',
                  password,
                  role: 'admin',
                  service_id: b.service.id,
                },
              })
            ).status,
            400
          );
          const session = await request('/auth/me', { cookie: cookieA });
          assert.equal(session.status, 200);
          assert.equal(session.json.user.password_hash, undefined);
          assert.equal(session.json.user.email, 'admin-a@example.test');
          assert.equal(
            (
              await request('/auth/login', {
                method: 'POST',
                body: { email: 'admin-a@example.test', password: 'wrong' },
              })
            ).status,
            401
          );
          assert.equal((await request('/auth/me')).status, 401);
        }
      );
      await t.test(
        'users, roles, profiles, and service ownership are enforced',
        async () => {
          const result = await request('/users', {
            method: 'POST',
            cookie: cookieA,
            body: {
              full_name: 'Developer',
              email: 'developer@example.test',
              password,
              role: 'developer',
            },
          });
          assert.equal(result.status, 201);
          member = result.json.user;
          assert.equal(member.role, 'user');
          const cookie = await login('developer@example.test');
          assert.equal((await request('/users', { cookie })).status, 403);
          assert.equal(
            (await request('/rules', { method: 'POST', cookie, body: {} }))
              .status,
            403
          );
          assert.equal(
            (
              await request(`/users/${b.user.id}`, {
                method: 'PATCH',
                cookie: cookieA,
                body: {
                  full_name: 'Wrong tenant',
                  email: 'wrong@example.test',
                },
              })
            ).status,
            404
          );
          assert.equal(
            (
              await request('/users', {
                method: 'POST',
                cookie: cookieA,
                body: {
                  full_name: 'Forged',
                  email: 'forged@example.test',
                  password,
                  role: 'user',
                  service_id: b.service.id,
                },
              })
            ).status,
            400
          );
          assert.equal(
            (
              await request(`/users/${member.id}`, {
                method: 'PATCH',
                cookie: cookieA,
                body: {
                  full_name: 'Updated Developer',
                  email: 'developer@example.test',
                },
              })
            ).status,
            200
          );
          const changed = await request(`/users/${member.id}/role`, {
            method: 'PATCH',
            cookie: cookieA,
            body: { role: 'guest' },
          });
          assert.equal(changed.status, 200);
          assert.equal((await request('/auth/me', { cookie })).status, 401);
          const guest = await login('developer@example.test');
          assert.equal(
            (await request('/services/current', { cookie: guest })).json.service
              .api_keys,
            undefined
          );
          assert.equal(
            (
              await request('/users/me', {
                method: 'PATCH',
                cookie: guest,
                body: {
                  full_name: 'Guest Updated',
                  email: 'developer@example.test',
                },
              })
            ).status,
            200
          );
          assert.equal(
            (
              await request('/users/me', {
                method: 'PATCH',
                cookie: guest,
                body: {
                  full_name: 'Escalate',
                  email: 'developer@example.test',
                  role: 'admin',
                },
              })
            ).status,
            400
          );
          assert.equal(
            (
              await request(`/users/${member.id}`, {
                method: 'DELETE',
                cookie: cookieA,
              })
            ).status,
            200
          );
          assert.equal(
            (await request('/auth/me', { cookie: guest })).status,
            401
          );
          assert.equal(
            (await request('/users/me', { method: 'DELETE', cookie: cookieB }))
              .status,
            409
          );
        }
      );
      await t.test(
        'last administrator survives concurrent demotion attempts',
        async () => {
          const c = await register('Concurrent', 'concurrent@example.test');
          const cookie = await login('concurrent@example.test');
          const second = (
            await request('/users', {
              method: 'POST',
              cookie,
              body: {
                full_name: 'Second administrator',
                email: 'second@example.test',
                password,
                role: 'admin',
              },
            })
          ).json.user;
          const results = await Promise.all(
            [c.user.id, second.id].map((id) =>
              request(`/users/${id}/role`, {
                method: 'PATCH',
                cookie,
                body: { role: 'user' },
              })
            )
          );
          assert.deepEqual(
            results.map((result) => result.status).sort(),
            [200, 409]
          );
          assert.equal(
            Number(
              (
                await pool.query(
                  "SELECT COUNT(*) FROM users WHERE service_id=$1 AND role='admin'",
                  [c.service.id]
                )
              ).rows[0].count
            ),
            1
          );
        }
      );
      await t.test(
        'keys are hashed, tenant-bound, and only returned at creation',
        async () => {
          const resultA = await request('/services/current/api-keys', {
            method: 'POST',
            cookie: cookieA,
            body: {},
          });
          const resultB = await request('/services/current/api-keys', {
            method: 'POST',
            cookie: cookieB,
            body: {},
          });
          assert.equal(resultA.status, 201);
          keyA = resultA.json.api_key;
          keyB = resultB.json.api_key;
          const view = await request('/services/current', { cookie: cookieA });
          assert.ok(view.json.service.api_keys.length);
          assert.ok(!JSON.stringify(view.json).includes(keyA));
          assert.ok(!JSON.stringify(view.json).includes('key_hash'));
          const stored = (
            await pool.query(
              'SELECT key_hash FROM api_keys WHERE service_id=$1',
              [a.service.id]
            )
          ).rows[0].key_hash;
          assert.notEqual(stored, keyA);
          assert.equal(stored.length, 64);
          assert.equal((await request('/waf/config')).status, 401);
          assert.equal(
            (await request('/waf/config', { apiKey: keyA })).status,
            200
          );
          assert.equal(
            (
              await request('/services/current', {
                method: 'PATCH',
                cookie: cookieA,
                body: { service_name: 'Service A updated' },
              })
            ).status,
            200
          );
        }
      );
      await t.test(
        'rule CRUD protects defaults and validates updates',
        async () => {
          const listed = await request('/rules', { cookie: cookieA });
          const shared = listed.json.rules.find(
            (rule) => String(rule.service_id) === '0'
          );
          assert.equal(
            (
              await request(`/rules/${shared.id}`, {
                method: 'PATCH',
                cookie: cookieA,
                body: { enabled: false },
              })
            ).status,
            404
          );
          const connection = await pool.connect();
          try {
            await assert.rejects(
              connection.query('DELETE FROM rules WHERE id=$1', [shared.id]),
              /read-only/
            );
          } finally {
            connection.release();
          }
          const result = await request('/rules', {
            method: 'POST',
            cookie: cookieA,
            body: {
              name: 'Tenant A pattern',
              pattern: 'only-a-secret-pattern',
              match_type: 'keyword',
              score: 50,
              enabled: true,
              description: '',
            },
          });
          assert.equal(result.status, 201);
          ruleA = result.json.rule;
          assert.equal(
            (
              await request(`/rules/${ruleA.id}`, {
                method: 'PATCH',
                cookie: cookieB,
                body: { enabled: false },
              })
            ).status,
            404
          );
          assert.equal(
            (
              await request('/rules', {
                method: 'POST',
                cookie: cookieA,
                body: {
                  name: 'Bad regex',
                  pattern: '[',
                  match_type: 'regex',
                  score: 10,
                  enabled: true,
                },
              })
            ).status,
            400
          );
          const keyword = await request('/rules', {
            method: 'POST',
            cookie: cookieA,
            body: {
              name: 'Literal bracket',
              pattern: '[',
              match_type: 'keyword',
              score: 10,
              enabled: true,
            },
          });
          assert.equal(keyword.status, 201);
          assert.equal(
            (
              await request(`/rules/${keyword.json.rule.id}`, {
                method: 'PATCH',
                cookie: cookieA,
                body: { match_type: 'regex' },
              })
            ).status,
            400
          );
          assert.equal(
            (
              await request(`/rules/${keyword.json.rule.id}`, {
                method: 'DELETE',
                cookie: cookieA,
              })
            ).status,
            200
          );
          assert.equal(
            (await request('/waf/config', { apiKey: keyB })).json.rules.some(
              (rule) => rule.name === 'Tenant A pattern'
            ),
            false
          );
        }
      );
      await t.test(
        'telemetry is authenticated, redacted, deduplicated, persisted, and isolated on sockets',
        async () => {
          const unauth = io(base, {
            transports: ['websocket'],
            reconnection: false,
            timeout: 1000,
          });
          sockets.push(unauth);
          await once(unauth, 'connect_error');
          unauth.disconnect();
          const socketA = await connect(cookieA);
          const socketB = await connect(cookieB);
          const eventsB = [];
          socketB.on('incident-log', (event) => eventsB.push(event));
          const event = {
            requestID: 'integration-block-1',
            timestamp: new Date().toISOString(),
            ip: '192.0.2.1',
            method: 'POST',
            path: '/login',
            score: 65.5,
            decision: 'BLOCK',
            strictness: 'normal',
            latency_ms: 1.4,
            payload: {
              body: { password: 'SHOULD_NOT_APPEAR' },
              headers: { authorization: 'SHOULD_NOT_APPEAR' },
            },
            matched_rules: [],
            indicators: [],
          };
          assert.equal(
            (await request('/logs', { method: 'POST', body: event })).status,
            401
          );
          assert.equal(
            (
              await request('/logs', {
                method: 'POST',
                apiKey: keyA,
                body: { ...event, service_id: b.service.id },
              })
            ).status,
            400
          );
          const received = once(socketA, 'incident-log');
          assert.equal(
            (
              await request('/logs', {
                method: 'POST',
                apiKey: keyA,
                body: event,
              })
            ).status,
            200
          );
          const [live] = await received;
          assert.equal(String(live.service_id), String(a.service.id));
          assert.ok(!JSON.stringify(live).includes('SHOULD_NOT_APPEAR'));
          await request('/logs', { method: 'POST', apiKey: keyA, body: event });
          await request('/logs', {
            method: 'POST',
            apiKey: keyA,
            body: {
              ...event,
              requestID: 'integration-allow-1',
              decision: 'ALLOW',
              latency_ms: 2.6,
              payload: {},
            },
          });
          const summary = (
            await request('/dashboard/summary', { cookie: cookieA })
          ).json;
          assert.equal(summary.total_inspected, 2);
          assert.equal(summary.total_blocked, 1);
          assert.equal(summary.average_latency_ms, 2);
          assert.equal(
            (await request('/logs', { cookie: cookieA })).json.logs.length,
            1
          );
          assert.equal(
            (await request('/logs', { cookie: cookieB })).json.logs.length,
            0
          );
          await new Promise((resolve) => setTimeout(resolve, 80));
          assert.equal(eventsB.length, 0);
          const disconnected = once(socketB, 'disconnect');
          await request('/auth/logout', { method: 'POST', cookie: cookieB });
          await disconnected;
          assert.equal(
            (await request('/auth/me', { cookie: cookieB })).status,
            401
          );
          cookieB = await login('admin-b@example.test');
        }
      );
      await t.test(
        'actual middleware blocks/permits, keeps service caches separate, and updates metrics',
        async () => {
          const outputs = [];
          async function protect(key) {
            const app = express();
            app.use(express.json());
            const waf = mywaf({
              mode: 'hybrid',
              strict: 'NORMAL',
              apiKey: key,
              backendUrl: base,
              logger: { log: (event) => outputs.push(event), warn: () => {} },
            });
            await waf.ready;
            app.use(waf);
            app.all('/check', (req, res) => res.json({ allowed: true }));
            const server = createServer(app);
            const url = await listen(server);
            const record = { waf, server, url };
            protectedApps.push(record);
            return record;
          }
          const first = await protect(keyA);
          const second = await protect(keyB);
          assert.equal(
            (await fetch(first.url + '/check?q=only-a-secret-pattern')).status,
            403
          );
          assert.equal(
            (await fetch(second.url + '/check?q=only-a-secret-pattern')).status,
            200
          );
          assert.equal(
            (
              await fetch(
                first.url + '/check?q=' + encodeURIComponent('1 OR 1=1--')
              )
            ).status,
            403
          );
          assert.equal(
            (
              await fetch(first.url + '/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  password: 'NEVER_LOG_THIS',
                  search: 'UNION SELECT NULL',
                }),
              })
            ).status,
            403
          );
          assert.ok(!JSON.stringify(outputs).includes('NEVER_LOG_THIS'));
          await first.waf.flush();
          await second.waf.flush();
          assert.ok(
            (await request('/dashboard/summary', { cookie: cookieA })).json
              .total_inspected >= 5
          );
          await request(`/rules/${ruleA.id}`, {
            method: 'PATCH',
            cookie: cookieA,
            body: { enabled: false },
          });
          await first.waf.refreshRules();
          assert.equal(
            (await fetch(first.url + '/check?q=only-a-secret-pattern')).status,
            200
          );
          const activeKey = (
            await request('/services/current', { cookie: cookieA })
          ).json.service.api_keys.find((key) => key.is_active);
          await request(`/services/current/api-keys/${activeKey.id}`, {
            method: 'DELETE',
            cookie: cookieA,
          });
          assert.equal(
            (await request('/waf/config', { apiKey: keyA })).status,
            401
          );
          assert.equal(
            (
              await fetch(
                first.url +
                  '/check?q=' +
                  encodeURIComponent('UNION SELECT NULL')
              )
            ).status,
            403,
            'Cached inspection continues after telemetry access is revoked'
          );
          await first.waf.flush();
          const rotated = await request('/services/current/api-keys', {
            method: 'POST',
            cookie: cookieA,
            body: { rotate: true },
          });
          keyA = rotated.json.api_key;
          assert.equal(
            (await request('/waf/config', { apiKey: keyA })).status,
            200
          );
        }
      );
      await t.test(
        'password reset is single-use, current-password checks work, and old sessions are invalidated',
        async () => {
          assert.equal(
            (
              await request('/auth/reset-password', {
                method: 'POST',
                body: { email: 'admin-b@example.test', newPassword: password },
              })
            ).status,
            400
          );
          assert.equal(
            (
              await request('/auth/forgot-password', {
                method: 'POST',
                body: { email: 'nonexistent@example.test' },
              })
            ).status,
            200
          );
          assert.equal(mail.length, 0);
          await request('/auth/forgot-password', {
            method: 'POST',
            body: { email: 'admin-b@example.test' },
          });
          assert.equal(mail.length, 1);
          const token = new URL(mail[0].link).searchParams.get('token');
          assert.notEqual(
            (await pool.query('SELECT token_hash FROM password_reset_tokens'))
              .rows[0].token_hash,
            token
          );
          const resetBody = { token, password: 'NewPassword456!' };
          assert.equal(
            (
              await request('/auth/reset-password', {
                method: 'POST',
                body: resetBody,
              })
            ).status,
            200
          );
          assert.equal(
            (
              await request('/auth/reset-password', {
                method: 'POST',
                body: resetBody,
              })
            ).status,
            400
          );
          assert.equal(
            (await request('/auth/me', { cookie: cookieB })).status,
            401
          );
          cookieB = await login('admin-b@example.test', 'NewPassword456!');
          assert.equal(
            (
              await request('/users/me/password', {
                method: 'PATCH',
                cookie: cookieB,
                body: { current_password: 'wrong', password },
              })
            ).status,
            400
          );
          assert.equal(
            (
              await request('/users/me/password', {
                method: 'PATCH',
                cookie: cookieB,
                body: { current_password: 'NewPassword456!', password },
              })
            ).status,
            200
          );
          assert.equal(
            (await request('/auth/me', { cookie: cookieB })).status,
            401
          );
          cookieB = await login('admin-b@example.test');
          await pool.query(
            "UPDATE sessions SET expires_at=NOW()-INTERVAL '1 second' WHERE user_id=$1",
            [b.user.id]
          );
          assert.equal(
            (await request('/auth/me', { cookie: cookieB })).status,
            401
          );
        }
      );
      await t.test(
        'untrusted origins and body formats are rejected',
        async () => {
          assert.equal(
            (
              await request('/services/current', {
                method: 'PATCH',
                cookie: cookieA,
                requestOrigin: 'https://untrusted.example',
                body: { service_name: 'Forged' },
              })
            ).status,
            403
          );
          assert.equal(
            (
              await request('/services/current', {
                method: 'PATCH',
                cookie: cookieA,
                requestOrigin: null,
                body: { service_name: 'Forged' },
              })
            ).status,
            403
          );
          const response = await fetch(base + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: 'bad',
          });
          assert.equal(response.status, 415);
        }
      );
      await t.test(
        'the delivered frontend service modules work with the delivered backend',
        async () => {
          const {
            authServices: auth,
            userServices: users,
            ruleServices: rules,
            dashboardServices: dashboard,
          } = await frontendClient(base, origin);
          await auth.registerService({
            service_name: 'Frontend integration',
            full_name: 'Frontend Admin',
            email: 'frontend@example.test',
            password,
          });
          const user = await auth.login({
            email: 'frontend@example.test',
            password,
          });
          assert.equal(user.role, 'admin');
          assert.equal(user.service.service_name, 'Frontend integration');
          await users.createUser({
            full_name: 'Frontend Member',
            email: 'front-member@example.test',
            password,
            role: 'user',
          });
          const member = (await users.listUsers()).find(
            (row) => row.email === 'front-member@example.test'
          );
          assert.ok(member);
          await users.updateUser(member.id, {
            full_name: 'Edited Member',
            email: 'front-member@example.test',
          });
          await users.updateRole(member.id, 'guest');
          assert.equal(
            (await users.listUsers()).find((row) => row.id === member.id).role,
            'guest'
          );
          await users.deleteUser(member.id);
          await rules.createRule({
            name: 'Frontend rule',
            pattern: 'test-pattern',
            match_type: 'keyword',
            score: 30,
            enabled: true,
            description: '',
          });
          const rule = (await rules.listRules()).find(
            (row) => row.name === 'Frontend rule'
          );
          assert.ok(rule);
          await rules.updateRule(rule.id, { enabled: false });
          await rules.deleteRule(rule.id);
          await dashboard.updateService({ service_name: 'Frontend verified' });
          assert.equal(
            (await dashboard.getService()).service_name,
            'Frontend verified'
          );
          const key = await dashboard.createServiceKey();
          assert.ok(key.api_key);
          await dashboard.revokeServiceKey(key.id);
          assert.equal((await dashboard.listLogs()).length, 0);
          assert.equal((await dashboard.getSummary()).total_inspected, 0);
          await users.updateProfile({
            full_name: 'Frontend Admin Updated',
            email: 'frontend@example.test',
          });
          assert.equal(
            (await auth.getSession()).full_name,
            'Frontend Admin Updated'
          );
          await auth.changePassword({
            current_password: password,
            password: 'ChangedPassword456!',
          });
          await assert.rejects(
            auth.getSession(),
            (error) => error.status === 401
          );
          await auth.login({
            email: 'frontend@example.test',
            password: 'ChangedPassword456!',
          });
          await auth.logout();
          await assert.rejects(
            auth.getSession(),
            (error) => error.status === 401
          );
        }
      );
    } finally {
      for (const socket of sockets) socket.disconnect();
      for (const item of protectedApps) {
        await closeHttp(item.server);
        await item.waf.close();
      }
      if (application) await application.close();
      await database.close();
    }
  }
);
