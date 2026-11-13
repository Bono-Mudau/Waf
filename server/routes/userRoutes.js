import { Router } from 'express';
import { requireAdmin } from '../APIs/middleware/jwt.js';
export function userRoutes(controllers, authControllers, session) {
  const router = Router();
  router.use(session);
  router.get('/me', controllers.me);
  router.patch('/me', controllers.updateMe);
  router.patch('/me/password', authControllers.changePassword);
  router.delete('/me', controllers.removeMe);
  router.use(requireAdmin);
  router.get('/', controllers.list);
  router.post('/', controllers.create);
  router.patch('/:id/role', controllers.role);
  router.patch('/:id', controllers.update);
  router.delete('/:id', controllers.remove);
  return router;
}
