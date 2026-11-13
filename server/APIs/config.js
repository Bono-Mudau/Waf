export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const jwtSecret = env.JWT_SECRET || '';
  if (jwtSecret.length < 32 || jwtSecret.startsWith('replace-this'))
    throw new Error(
      'Set JWT_SECRET to a random secret of at least 32 characters.'
    );
  const origins = (env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((value) => new URL(value.trim()).origin);
  const frontendUrl = new URL(env.PUBLIC_FRONTEND_URL || origins[0]).origin;
  const secure = env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : production;
  const sameSite = (env.COOKIE_SAMESITE || 'lax').toLowerCase();
  if (
    !['lax', 'strict', 'none'].includes(sameSite) ||
    (sameSite === 'none' && !secure)
  )
    throw new Error(
      'Invalid cookie configuration: SameSite=None requires Secure.'
    );
  if (
    production &&
    (!secure ||
      !frontendUrl.startsWith('https:') ||
      origins.some((origin) => !origin.startsWith('https:')))
  )
    throw new Error('Production frontend origins and cookies must use HTTPS.');
  const trustProxy = Number(env.TRUST_PROXY || 0);
  if (![0, 1].includes(trustProxy))
    throw new Error('TRUST_PROXY must be 0 or 1.');
  return {
    production,
    jwtSecret,
    origins,
    frontendUrl,
    secure,
    sameSite,
    trustProxy,
    sessionSeconds: 1800,
    hashRounds: 12,
    smtp:
      env.SMTP_HOST && env.MAIL_FROM
        ? {
            host: env.SMTP_HOST,
            port: Number(env.SMTP_PORT || 587),
            secure: env.SMTP_SECURE === 'true',
            requireTLS: env.SMTP_SECURE !== 'true',
            tls: { rejectUnauthorized: true },
            ...(env.SMTP_USER
              ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
              : {}),
            from: env.MAIL_FROM,
          }
        : null,
  };
}
