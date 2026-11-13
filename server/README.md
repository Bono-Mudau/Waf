# SQLiShield backend

Express API, PostgreSQL persistence, authenticated Socket.IO incident delivery, and Node.js WAF middleware. The existing `APIs`, `Controllers`, `db`, `Docs`, `routes`, `waf`, and `websocket` folders are retained. Controller/service imports use ES modules consistently. `Controllers/rulesControllers.js` is a compatibility re-export of the implementation in `APIs/controllers`.

## Setup

Use Node.js 24 and a PostgreSQL 15+ database. Run `npm ci`, copy `.env.example` to `.env`, configure your database and a random `JWT_SECRET`, then run:

```sh
npm run db:migrate
npm run dev
```

`npm start` runs the server without watch mode. `npm run test:app` runs the protected sample on port 3001. `npm test` runs engine/unit checks; `npm run test:integration` runs database/API/socket/middleware/frontend-contract and migration checks.

Database configuration supports `DATABASE_URL` or the individual `DB_*` fields. `DB_SSL=true` enables TLS with certificate verification. For providers using a private CA, configure a trusted CA through the Node runtime rather than disabling verification.

The `.env` uploaded with the original project is not included in this source package. Reuse its DB settings locally; do not put backend secrets in `client` or any `VITE_` variable.

## Schema and upgrades

`db/migrate.js` applies versioned SQL inside a transaction under an advisory lock. It does **not** drop tables, reset data, or run on every server startup. The server refuses startup until migration `001` is recorded. Use `npm run db:migrate` explicitly.

Current membership is **services 1 → many users**, represented by `users.service_id`. Service ID `0` is reserved for shared rules; dashboard accounts and service keys cannot belong to it. Normal registration creates one service, its administrator, and an initial metrics row in one transaction. Public requests cannot supply a role or service ID.

Migration `001` supports the existing `users.service_id` design and the older `services.user_id` ownership design. For legacy ownership, an unassigned user is linked only when the relationship is unambiguous. The historical owner column remains, becomes optional, and its FK uses `ON DELETE SET NULL`; the API uses user membership going forward. Legacy `developer` roles become `user` (displayed as Developer). Existing default rules are preserved exactly; an empty catalogue receives the bundled 25-rule seed.

The upgrade stops and rolls back if a user has multiple possible memberships, no valid membership, unknown roles, duplicate case-insensitive emails, or an active service lacks an active administrator. Resolve those records deliberately in your existing database, then rerun. Do not guess ownership or drop your tables to clear these messages. Other custom schemas may require a reviewed migration adjustment.

Tables include `services`, `users`, `rules`, `api_keys`, `sessions`, `password_reset_tokens`, `incident_logs`, `service_metrics`, and `request_receipts`, plus migration history. The provided PDF in `Docs` is retained as a historical reference; the SQL migration is the current implementation.

Shared rules are read-only through the API and an UPDATE/DELETE trigger. Default catalogue changes require a separate reviewed migration. Custom rules belong to the authenticated service. No API accepts a client-supplied service ID for management writes.

## Frontend API contract

The client included in `../client` already uses these routes. Success responses are JSON (or HTTP 204 where applicable); errors have an HTTP error status and `{message}`. User responses never contain password hashes. Service responses contain only API-key metadata, never stored key hashes or retrievable raw keys.

| Method           | Route                                | Behaviour                                                                                     |
| ---------------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| POST             | `/api/auth/register-service`         | `{service_name, full_name, email, password}` → service and administrator.                     |
| POST             | `/api/auth/login`                    | `{email,password}` → HttpOnly session cookie.                                                 |
| GET              | `/api/auth/me`                       | Current `{user,service}`.                                                                     |
| POST             | `/api/auth/logout`                   | Revoke the current session, clear its cookie, disconnect its sockets.                         |
| POST             | `/api/auth/forgot-password`          | `{email}` → neutral acknowledgement after configured mail handling.                           |
| POST             | `/api/auth/reset-password`           | `{token,password}` → consume reset token, revoke all account sessions.                        |
| GET              | `/api/users`                         | Administrator-only service member list.                                                       |
| POST             | `/api/users`                         | Admin creates `{full_name,email,password,role}`.                                              |
| PATCH            | `/api/users/:id`                     | Admin edits `{full_name,email}` in their own service.                                         |
| PATCH            | `/api/users/:id/role`                | Admin assigns `{role}`; existing member sessions are revoked.                                 |
| DELETE           | `/api/users/:id`                     | Admin removes a member from their service.                                                    |
| GET/PATCH/DELETE | `/api/users/me`                      | Current profile, profile update, or account deletion.                                         |
| PATCH            | `/api/users/me/password`             | `{current_password,password}`; revokes all sessions and requires sign-in again.               |
| GET/POST         | `/api/rules`                         | List shared/service rules; admins create custom rules.                                        |
| PATCH/DELETE     | `/api/rules/:id`                     | Admin updates/removes a service custom rule.                                                  |
| GET/PATCH        | `/api/services/current`              | Service details; admins edit `{service_name}`.                                                |
| POST             | `/api/services/current/api-keys`     | Admin creates a key; `{rotate:true}` revokes existing keys first. Returns raw `api_key` once. |
| DELETE           | `/api/services/current/api-keys/:id` | Admin revokes a service key.                                                                  |
| GET              | `/api/logs?limit=200`                | Most recent retained blocked incidents, maximum 200.                                          |
| GET              | `/api/dashboard/summary`             | Received inspection count, blocked count, average latency, enabled-rule count.                |
| GET              | `/api/waf/config`                    | Service API-key authentication; enabled shared + service rules.                               |
| POST             | `/api/logs`                          | Service API-key authentication; accepts middleware telemetry.                                 |
| GET              | `/api/health`                        | Database connectivity; HTTP 503 if unavailable.                                               |

API roles are `admin`, `user`, and `guest`. Incoming `developer` is accepted as an alias for `user`. Non-admins can view their service's incidents/rules and edit their own profile/password; only admins manage team accounts, custom rules, service details, or keys. Last-administrator checks run under a service-row lock, so concurrent removals/demotions cannot leave the service without an administrator.

Custom rules accept `name`, `description`, `pattern`, `match_type` (`keyword` or `regex`), integer `score` from 1–100, and boolean `enabled`. Patterns are limited to 1000 characters; a service can create up to 100 custom rules. Partial updates validate the resulting regex as well as individual fields.

## Authentication and email

JWTs identify database-backed sessions rather than carrying authoritative roles. Every protected HTTP request rechecks the current user, service, and session expiry. Session identifiers and reset tokens are stored as SHA-256 hashes; password hashes use bcrypt-compatible `bcryptjs`. Passwords require eight characters, uppercase/lowercase letters and a number, and at most 72 UTF-8 bytes.

Cookies are HttpOnly, use `SameSite=Lax` by default, and use Secure in production. Browser mutations with a session cookie require a trusted Origin. JSON bodies, explicit CORS origins, body-size limits, Helmet, and request limits are configured. Rate limits use an in-process store: a deployment with multiple server instances needs a shared limiter store.

Configure `SMTP_HOST`, `SMTP_PORT`, optional SMTP credentials, and `MAIL_FROM` to enable recovery. Set `PUBLIC_FRONTEND_URL` to your frontend origin so reset links point to the right page. The SMTP server must support the selected TLS settings; credentials and reset URLs are never logged. Reset links expire after 30 minutes and are single-use. Missing SMTP configuration returns HTTP 503 instead of pretending an email was sent.

All sessions and connected user sockets are invalidated on password change/reset or role change. Logout revokes the current session. Socket handshakes require the same session cookie; sockets join only their verified service room. Events use **`incident-log`** and never broadcast globally. A 15-second validity check also disconnects sessions that expire while idle.

## WAF integration

Import `mywaf` from this project's `waf/waf.js`; adjust the relative import for the protected application. This is a source project, not a published npm package.

```js
import { mywaf } from './waf/waf.js';

app.use(express.json({ limit: '48kb' }));
app.use(express.urlencoded({ extended: true, limit: '48kb' }));
const waf = mywaf({
  mode: 'hybrid',
  strict: 'normal',
  apiKey: process.env.SQLISHIELD_API_KEY,
  backendUrl: process.env.SQLISHIELD_BACKEND_URL || 'http://localhost:3000',
});
app.use(waf);
// Protected application routes follow here.
```

- **Local:** bundled default rules and console logging only. No service key, backend connection, PostgreSQL credentials, or network telemetry is required by the protected app.
- **Hybrid:** authenticated PostgreSQL rules are retrieved through the API and telemetry is sent asynchronously. The backend, not the protected application, owns database credentials. Different middleware instances maintain separate rules.
- Thresholds remain low **40**, normal **25**, high **15**. Configuration casing is normalised.
- The request inspection copy decodes at most four times, applies NFKC, lowercases, and collapses whitespace. It inspects path, query, body, and non-credential headers without changing the original Express request.
- Rules and heuristic contributions remain separate in the detector. Benign input and representative SQLi payloads are covered by tests; inspection remains heuristic and can have false positives/negatives. Continue using parameterised database queries.
- Regex execution runs in a bounded worker queue, outside the HTTP event loop. The default execution budget is 100 ms. A worker that exceeds the budget is terminated and replaced. Deep/oversized input returns 413; inspection errors, unavailable initial hybrid rules, and capacity/time-limit failures return 503. This makes failure behaviour explicit rather than silently bypassing the WAF.
- PostgreSQL-backed rules refresh every 30 seconds. If refresh/log delivery fails after initialisation, inspection continues with the last loaded rules. If no initial rules can be loaded, requests receive 503 until a refresh succeeds. Revoked keys stop configuration/telemetry access; cached local inspection continues.
- Console output and blocked payloads redact known credential fields. Matching metadata omits original matched values. Body/query/header data is still application data: review what your application sends and who can view its incidents.

Use HTTPS for a remote backend; plain HTTP is allowed only for loopback development. Service keys must remain on the protected application's server. Up to five keys may be active per service. Creating a replacement with rotation revokes all prior keys, so update every protected application that used them.

## Telemetry behaviour and limits

Hybrid mode reports an event for each completed inspection. ALLOW events contribute to totals/latency and a minimal deduplication receipt; only BLOCK events persist payload details and emit dashboard incidents. Local-only traffic is not represented in dashboard totals. The frontend labels metrics as telemetry received since registration and filters only loaded records.

Events require `requestID`, ISO `timestamp`, `ip` (or null), uppercase `method`, `path`, numeric `score`, `decision` (`ALLOW`/`BLOCK`), `latency_ms`, and `strictness`. Blocked records may include `matched_rules`, `indicators`, and a redacted `payload`. Service identity comes from `X-API-Key`, never the event body. The backend redacts again before persistence and delivery. IPs, field sizes, scores, and request structure are validated.

Receipts and metrics update in one transaction; repeated service/request IDs do not increment totals again. The sender limits concurrency to four and its pending queue to 256, retries delivery once, and uses a three-second request timeout. Outages/queue overflow can drop events; totals describe received telemetry rather than guaranteeing complete traffic accounting. No queue or network request delays the application decision. `await waf.flush()` drains pending telemetry when you need a test checkpoint; `await waf.close()` releases the sender and worker during shutdown.

Retained incidents and deduplication receipts are not automatically deleted. Plan retention for the deployment's traffic volume. If you delete receipts, the retry deduplication window becomes the retained receipt period. Expired session/reset rows can be removed as routine database maintenance.

## Tests and verification boundaries

Default integration tests create a disposable PostgreSQL engine through PGlite and exercise the production `pg` client over its socket adapter. The suite uses real SQL, triggers, transactions, HTTP endpoints, Socket.IO rooms, WAF workers, recovery tokens, and the delivered frontend API service modules. No fake API is shipped in the application, and the tests do not read `.env`.

PGlite serialises a single database connection; native PostgreSQL still needs checking for your host, TLS/authentication, connection limits, and traffic. Set `TEST_DATABASE_URL` explicitly to run the same tests on a native test database. They create a uniquely named schema and delete only that test schema afterwards. SMTP transport to your provider is configuration-dependent; tests inject an in-memory mail sink without sending email.

For production, set `NODE_ENV=production`, a private JWT secret, HTTPS `FRONTEND_URL`/`PUBLIC_FRONTEND_URL`, `COOKIE_SECURE=true`, and `HOST=0.0.0.0` if required by the host. Set `TRUST_PROXY=1` only behind one trusted reverse proxy. Prefer serving frontend and API through the same site; if deploying them separately, build the client with the correct public API/socket URLs and configure cookie SameSite behaviour for that deployment. A proxy must forward Socket.IO upgrades and preserve the browser Origin.
