import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createPool } from './db/dbConfig.js';
import { loadConfig } from './APIs/config.js';
import { createAuthService } from './APIs/services/authServices.js';
import { createUserService } from './APIs/services/userService.js';
import { createServiceService } from './APIs/services/serviceService.js';
import { createRuleService } from './APIs/services/ruleService.js';
import { createLogService, validateEvent } from './APIs/services/logService.js';
import { createAuthControllers } from './APIs/controllers/authControllers.js';
import { createUserControllers } from './APIs/controllers/userControllers.js';
import { createRuleControllers } from './APIs/controllers/ruleControllers.js';
import {
  createSessionMiddleware,
  requireAdmin,
} from './APIs/middleware/jwt.js';
import {
  HttpError,
  errorHandler,
  requireThat,
} from './APIs/middleware/errors.js';
import * as v from './APIs/Validators/validators.js';
import { authRoutes } from './routes/authRoutes.js';
import { userRoutes } from './routes/userRoutes.js';
import { rulesRoutes } from './routes/rulesRoutes.js';
import { setupWebSocket } from './websocket/socketServer.js';
import { RuleRepository } from './waf/ruleRepo.js';
import { RuleCache } from './waf/ruleCache.js';

export function createApplication({
  pool,
  config,
  sendResetMail,
  rateLimits = true,
}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  const httpServer = createServer(app);
  const auth = createAuthService(pool, config, sendResetMail);
  const users = createUserService(pool, config);
  const services = createServiceService(pool);
  const cache = new RuleCache(new RuleRepository(pool));
  const rules = createRuleService(pool, cache);
  const logs = createLogService(pool);
  const sockets = setupWebSocket(httpServer, { auth, config });
  const session = createSessionMiddleware(auth);
  const authControllers = createAuthControllers(
    auth,
    config,
    sockets.disconnect
  );
  const userControllers = createUserControllers(
    users,
    config,
    sockets.disconnect
  );
  const ruleControllers = createRuleControllers(rules);
  const passthrough = (req, res, next) => next();
  const authLimiter = rateLimits
    ? rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 20,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: {
          message: 'Too many authentication requests. Try again later.',
        },
      })
    : passthrough;
  const generalLimiter = rateLimits
    ? rateLimit({
        windowMs: 60000,
        limit: 300,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: { message: 'Too many requests. Try again shortly.' },
      })
    : passthrough;
  const ingestionLimiter = rateLimits
    ? rateLimit({
        windowMs: 60000,
        limit: 6000,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: { message: 'Telemetry rate limit reached.' },
      })
    : passthrough;
  const apiKey = async (req, res, next) => {
    try {
      req.apiKey = await services.authenticateKey(req.get('x-api-key'));
      next();
    } catch (error) {
      next(error);
    }
  };

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, done) =>
        done(
          origin && !config.origins.includes(origin)
            ? new HttpError(403, 'Origin is not allowed.')
            : null,
          !origin || config.origins.includes(origin)
        ),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-API-Key'],
    })
  );
  app.use((req, res, next) => {
    // Browser mutations are accepted only from configured origins. API-key clients do not use cookies.
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers.origin &&
      !config.origins.includes(req.headers.origin)
    )
      return next(new HttpError(403, 'Origin is not allowed.'));
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers.cookie &&
      !config.origins.includes(req.headers.origin)
    )
      return next(
        new HttpError(
          403,
          'A trusted Origin header is required for cookie-authenticated changes.'
        )
      );
    if (
      Number(req.headers['content-length'] || 0) > 0 &&
      !req.is('application/json')
    )
      return next(
        new HttpError(415, 'Use application/json for request bodies.')
      );
    next();
  });
  app.use(express.json({ limit: '48kb' }));
  app.use(cookieParser());
  app.post('/api/logs', ingestionLimiter, apiKey, async (req, res) => {
    const event = validateEvent(req.body);
    const log = await logs.ingest(req.apiKey.service_id, event);
    if (log) sockets.sendBlockedRequest(log);
    res.json({ accepted: true, requestID: event.requestID });
  });
  app.get('/api/waf/config', ingestionLimiter, apiKey, async (req, res) => {
    const service = await services.get(req.apiKey.service_id);
    const enabledRules = await cache.getRules(req.apiKey.service_id);
    requireThat(
      enabledRules.length <= 250,
      'This service has too many enabled rules for bounded inspection.',
      503
    );
    res.json({ service_id: service.id, rules: enabledRules });
  });
  app.use('/api', generalLimiter);
  app.get('/api/health', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', service: 'SQLiShield', database: 'connected' });
    } catch {
      res
        .status(503)
        .json({
          status: 'unavailable',
          message: 'Database connection unavailable.',
        });
    }
  });
  app.use('/api/auth', authRoutes(authControllers, session, authLimiter));
  app.use('/api/users', userRoutes(userControllers, authControllers, session));
  app.use('/api/rules', rulesRoutes(ruleControllers, session));
  app.get('/api/logs', session, async (req, res) => {
    const raw = req.query.limit ?? '200';
    requireThat(
      typeof raw === 'string' &&
        /^\d{1,3}$/.test(raw) &&
        Number(raw) >= 1 &&
        Number(raw) <= 200,
      'Limit must be between 1 and 200.'
    );
    res.json({ logs: await logs.list(req.user.service_id, Number(raw)) });
  });
  app.get('/api/dashboard/summary', session, async (req, res) =>
    res.json(await logs.summary(req.user.service_id))
  );
  app.get('/api/services/current', session, async (req, res) =>
    res.json({
      service: await services.get(
        req.user.service_id,
        req.user.role === 'admin'
      ),
    })
  );
  app.patch(
    '/api/services/current',
    session,
    requireAdmin,
    async (req, res) => {
      v.onlyFields(req.body, ['service_name']);
      res.json({
        service: await services.update(
          req.user.service_id,
          v.text(req.body.service_name, 'Service name', 120)
        ),
      });
    }
  );
  app.post(
    '/api/services/current/api-keys',
    session,
    requireAdmin,
    async (req, res) => {
      v.onlyFields(req.body, ['rotate']);
      requireThat(
        req.body.rotate === undefined || typeof req.body.rotate === 'boolean',
        'Rotate must be a boolean.'
      );
      res
        .status(201)
        .json(
          await services.createKey(
            req.user.service_id,
            req.body.rotate === true
          )
        );
    }
  );
  app.delete(
    '/api/services/current/api-keys/:id',
    session,
    requireAdmin,
    async (req, res) => {
      await services.revokeKey(req.user.service_id, v.id(req.params.id));
      res.json({ message: 'API key revoked.' });
    }
  );
  app.use((req, res) =>
    res.status(404).json({ message: 'Endpoint not found.' })
  );
  app.use(errorHandler);
  return {
    app,
    httpServer,
    auth,
    services,
    cache,
    sockets,
    async close() {
      auth.close();
      httpServer.closeIdleConnections();
      await sockets.close();
    },
  };
}

export async function start() {
  dotenv.config({ quiet: true });
  const config = loadConfig();
  const pool = createPool();
  try {
    await pool
      .query("SELECT version FROM schema_migrations WHERE version='001'")
      .then((result) => {
        if (!result.rowCount) throw new Error('Run npm run db:migrate first.');
      });
    const application = createApplication({ pool, config });
    const port = Number(process.env.PORT || 3000);
    const host = process.env.HOST || '127.0.0.1';
    await new Promise((resolve, reject) => {
      application.httpServer.once('error', reject);
      application.httpServer.listen(port, host, resolve);
    });
    console.log(`SQLiShield backend listening on http://${host}:${port}`);
    let closing = false;
    const close = async () => {
      if (closing) return;
      closing = true;
      await application.close();
      await pool.end();
    };
    process.once('SIGINT', () => void close());
    process.once('SIGTERM', () => void close());
    return application;
  } catch (error) {
    await pool.end();
    throw error;
  }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  start().catch((error) => {
    console.error('SQLiShield startup failed:', error.message);
    process.exitCode = 1;
  });
