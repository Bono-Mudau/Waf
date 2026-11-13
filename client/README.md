# SQLiShield frontend

React + Vite client, retaining the project's `src/pages`, `components`, `hooks`, `routes`, `services`, and `styles` structure and navy/teal/purple theme. The matching Express/PostgreSQL backend is included in `../server`; see `../README.md` for the full setup sequence.

## Run

```sh
npm ci
npm run dev
```

The development server normally uses `http://localhost:5173`. Start the backend separately on port 3000. Vite proxies `/api` and `/socket.io` to it; no client environment file is needed for these defaults. If your backend is elsewhere, copy `.env.example` to `.env.local` and set `API_PROXY_TARGET`.

`npm run build` produces `dist`. `npm run preview` serves a production build and does not use the development proxy. Configure your deployment's reverse proxy or set full public `VITE_API_BASE_URL` and `VITE_SOCKET_URL` values **before building**. Never place private API keys, passwords, or JWT secrets in `VITE_` variables. Static hosting needs an `index.html` fallback for dashboard routes.

## Included functionality

- Homepage: features, workflow, Local/Hybrid comparison, integration guidance, and responsive navigation.
- Registration: creates a service and its first administrator in one backend transaction.
- Authentication: cookie sessions, protected routes, session expiry, sign-out, password recovery, and token-based reset forms.
- Dashboard: real metrics, service-scoped live incidents, log filtering, pagination, and redacted payload details.
- Rules: admin custom-rule CRUD and status changes; shared defaults are read-only.
- Team: admin-created accounts, temporary passwords, role changes, editing, and removal.
- Service: details, key creation, one-time copying, rotation, and revocation.
- Profile: details, password changes, and confirmed deletion subject to backend last-administrator checks.

New API keys are shown once in the service screen and kept only in component memory. Copy a key before dismissing it or navigating away. Stored prefixes identify keys but cannot authenticate an application. Rotation replaces all existing active keys; update your protected applications afterwards.

Roles are `admin`, `user` (displayed as Developer), and `guest`; legacy `developer` responses are supported. The server enforces permissions and derives the service from the session. Password changes revoke sessions and the client returns to sign-in. SMTP configuration is required for password-recovery email; missing SMTP reports a clear error.

The API endpoints are centralised in `src/services/apiClient.js` and match the included backend. Native `fetch` uses `credentials: 'include'`; Socket.IO uses the authenticated session cookie and `incident-log` events. No credentials are kept in browser local/session storage. Failed requests never produce simulated success or a demo login.

Only blocked incidents are retained and streamed by this backend. ALLOW telemetry contributes to summary totals and latency, so an Allowed filter may have no saved rows. Filters/pagination apply to at most 200 loaded saved incidents plus this session's 100 live events; they are not a complete historical query. PostgreSQL rule changes reach protected hybrid apps on their next rule refresh (normally within 30 seconds).

Payload rendering masks known sensitive field names; the backend also redacts before transmission/storage. Review application data before sharing it. Parameterised queries remain necessary alongside WAF inspection.

The production build was checked. Backend integration tests also execute these actual frontend API service modules against the included backend and isolated PostgreSQL test engine.
