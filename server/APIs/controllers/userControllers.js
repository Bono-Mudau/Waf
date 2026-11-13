import * as v from '../Validators/validators.js';
import { cookieOptions } from '../services/authServices.js';

export function createUserControllers(users, config, disconnect) {
  const details = (body) => ({
    full_name: v.text(body.full_name, 'Full name', 120),
    email: v.email(body.email),
  });
  return {
    list: async (req, res) =>
      res.json({ users: await users.list(req.user.service_id) }),
    create: async (req, res) => {
      v.onlyFields(req.body, ['full_name', 'email', 'role', 'password']);
      res
        .status(201)
        .json({
          user: await users.create(req.user.service_id, {
            ...details(req.body),
            role: v.role(req.body.role),
            password: v.password(req.body.password),
          }),
        });
    },
    update: async (req, res) => {
      v.onlyFields(req.body, ['full_name', 'email']);
      res.json({
        user: await users.update(
          req.user.service_id,
          v.id(req.params.id),
          details(req.body)
        ),
      });
    },
    role: async (req, res) => {
      v.onlyFields(req.body, ['role']);
      const userId = v.id(req.params.id);
      const user = await users.role(
        req.user.service_id,
        userId,
        v.role(req.body.role)
      );
      disconnect({ user: userId });
      res.json({ user });
    },
    remove: async (req, res) => {
      const userId = v.id(req.params.id);
      await users.remove(req.user.service_id, userId);
      disconnect({ user: userId });
      res.json({ message: 'Member removed.' });
    },
    me: async (req, res) => res.json({ user: req.user }),
    updateMe: async (req, res) => {
      v.onlyFields(req.body, ['full_name', 'email']);
      res.json({
        user: await users.update(
          req.user.service_id,
          req.user.id,
          details(req.body)
        ),
      });
    },
    removeMe: async (req, res) => {
      await users.remove(req.user.service_id, req.user.id);
      disconnect({ user: req.user.id });
      res.clearCookie('token', cookieOptions(config));
      res.json({ message: 'Account deleted.' });
    },
  };
}
