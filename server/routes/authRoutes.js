import { Router } from 'express';
export function authRoutes(controllers, session, limiter) {
  const router = Router();
  router.post('/register-service', limiter, controllers.register);
  router.post('/login', limiter, controllers.login);
  router.post('/forgot-password', limiter, controllers.forgot);
  router.post('/reset-password', limiter, controllers.reset);
  router.get('/me', session, controllers.me);
  router.post('/logout', session, controllers.logout);
  return router;
}
