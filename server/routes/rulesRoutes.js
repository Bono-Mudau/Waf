import { Router } from 'express';
import { requireAdmin } from '../APIs/middleware/jwt.js';
export function rulesRoutes(controllers, session) {
  const router = Router();
  router.use(session);
  router.get('/', controllers.list);
  router.use(requireAdmin);
  router.post('/', controllers.create);
  router.patch('/:id', controllers.update);
  router.delete('/:id', controllers.remove);
  return router;
}
