export function createSessionMiddleware(auth) {
  return async (req, res, next) => {
    try {
      const session = await auth.authenticate(req.cookies?.token);
      req.user = session.user;
      req.session = session;
      next();
    } catch (error) {
      next(error);
    }
  };
}
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin')
    return res
      .status(403)
      .json({ message: 'Administrator access is required.' });
  next();
}
