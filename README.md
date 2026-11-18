# SQLiShield



```text
WAF/
  client/   React + Vite frontend
  server/   Express API, PostgreSQL schema, Socket.IO server, and WAF middleware
```

Use Node.js 24 and PostgreSQL 15 or later. Open the folder containing `client` and `server` in VS Code. Dependency folders and private environment settings are intentionally excluded; install dependencies in **both** folders.

## 1. Prepare PostgreSQL

Create an empty database named `sqlishield`, for example through pgAdmin. If upgrading your existing database, keep a backup and read `server/README.md` before running the migration. The migration preserves existing data and stops when legacy user/service relationships are ambiguous.

## 2. Start the backend

Open a terminal in `WAF/server`. These commands work in Windows Command Prompt:

```bat
npm ci
copy .env.example .env
```

Edit `server/.env` using your existing `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` values. Generate a private JWT secret with:

```bat
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Paste the result into `JWT_SECRET` in your local `.env`. Keep it private. Leave `FRONTEND_URL=http://localhost:5173` for the default frontend address.

Then run:

```bat
npm run db:migrate
npm run dev
```

The API starts on `http://localhost:3000`. Its database health check is `/api/health`. If the migration fails, the transaction rolls back; follow its error message rather than deleting tables.

## 3. Start the frontend

Open a second terminal in `WAF/client`:

```bat
npm ci
npm run dev
```

Open the URL Vite prints, normally `http://localhost:5173`. The development proxy forwards `/api` and `/socket.io` to port 3000. If Vite uses a different port, update the backend's `FRONTEND_URL` and `PUBLIC_FRONTEND_URL`, then restart the backend.

Register your service. This creates the service and its first administrator together. Sign in and use **Team members** to create additional accounts. Administrator, Developer, and Guest accounts are supported; only administrators manage team access, custom rules, and service credentials.

## 4. Connect a protected application

In **Manage service**, choose **Create API key** and copy the new key. It is shown once; the database stores only its hash. Set these local values in `server/.env` to try the included sample application:

```dotenv
WAF_MODE=hybrid
SQLISHIELD_API_KEY=your-new-service-api-key
SQLISHIELD_BACKEND_URL=http://localhost:3000
```

Open a third terminal in `WAF/server` and run:

```bat
npm run test:app
```

The sample app listens on port 3001. Open these URLs in a browser:

- Normal request: `http://localhost:3001/users?id=1`
- SQLi example: `http://localhost:3001/users?id=1%20OR%201=1--`

Normal input reaches the route; the SQLi example returns HTTP 403. In hybrid mode its incident appears in the dashboard and its telemetry updates the summary. **Local** mode works without a service key or running dashboard backend and logs only to the console.

Password recovery requires the SMTP fields in `server/.env`; email delivery is not simulated. When SMTP is not configured, the recovery form reports that the feature is unavailable. Other account and dashboard features work independently.

## Verification

In `server`:

```bat
npm test
npm run test:integration
```

Integration tests use a disposable in-memory PostgreSQL engine (PGlite), real SQL migrations, the `pg` wire-protocol driver, the HTTP API, authenticated Socket.IO clients, actual WAF middleware, and the frontend's API service modules. They never read your `.env` or use your database by default. To check against a native PostgreSQL server, explicitly set `TEST_DATABASE_URL` to a test database: the tests create and remove their own uniquely named schema.

In `client`, run `npm run build` for a production frontend build.

See each folder's README for endpoint details, migration compatibility, operating limits, and deployment configuration.
