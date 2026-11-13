import * as v from '../Validators/validators.js';
import { cookieOptions } from '../services/authServices.js';
import { requireThat } from '../middleware/errors.js';

export function createAuthControllers(auth, config, disconnect) {
  const setCookie = (res, token) =>
    res.cookie('token', token, {
      ...cookieOptions(config),
      maxAge: config.sessionSeconds * 1000,
    });
  return {
    register: async (req, res) => {
      v.onlyFields(req.body, [
        'service_name',
        'full_name',
        'email',
        'password',
      ]);
      const result = await auth.register({
        service_name: v.text(req.body.service_name, 'Service name', 120),
        full_name: v.text(req.body.full_name, 'Full name', 120),
        email: v.email(req.body.email),
        password: v.password(req.body.password),
      });
      res.status(201).json(result);
    },
    login: async (req, res) => {
      v.onlyFields(req.body, ['email', 'password']);
      const email = v.email(req.body.email);
      requireThat(
        typeof req.body.password === 'string' &&
          req.body.password.length > 0 &&
          req.body.password.length <= 1024,
        'Email and password are required.'
      );
      const token = await auth.login(email, req.body.password);
      setCookie(res, token);
      res.json({ message: 'Signed in.' });
    },
    me: async (req, res) =>
      res.json({ user: req.user, service: req.session.service }),
    logout: async (req, res) => {
      await auth.logout(req.session.tokenHash);
      disconnect({ session: req.session.tokenHash });
      res.clearCookie('token', cookieOptions(config));
      res.json({ message: 'Signed out.' });
    },
    forgot: async (req, res) => {
      v.onlyFields(req.body, ['email']);
      await auth.forgotPassword(v.email(req.body.email));
      res.json({
        message:
          'If an account exists, password reset instructions will be sent.',
      });
    },
    reset: async (req, res) => {
      v.onlyFields(req.body, ['token', 'password']);
      requireThat(
        typeof req.body.token === 'string' &&
          /^[a-f0-9]{64}$/.test(req.body.token),
        'The reset link is invalid or has expired.'
      );
      const userId = await auth.resetPassword(
        req.body.token,
        v.password(req.body.password)
      );
      disconnect({ user: userId });
      res.clearCookie('token', cookieOptions(config));
      res.json({ message: 'Password reset. Please sign in.' });
    },
    changePassword: async (req, res) => {
      v.onlyFields(req.body, ['current_password', 'password']);
      requireThat(
        typeof req.body.current_password === 'string' &&
          req.body.current_password.length <= 1024,
        'Enter your current password.'
      );
      await auth.changePassword(
        req.user.id,
        req.body.current_password,
        v.password(req.body.password)
      );
      disconnect({ user: req.user.id });
      res.clearCookie('token', cookieOptions(config));
      res.json({ message: 'Password updated. Please sign in again.' });
    },
  };
}
