import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { transaction } from '../../db/dbConfig.js';
import { HttpError, requireThat } from '../middleware/errors.js';

export const hashToken = (value) =>
  createHash('sha256').update(value).digest('hex');
export const publicUser = (user) => ({
  id: user.id,
  full_name: user.full_name,
  email: user.email,
  role: user.role,
  service_id: user.service_id,
});
export const cookieOptions = (config) => ({
  httpOnly: true,
  secure: config.secure,
  sameSite: config.sameSite,
  path: '/',
});

export function createAuthService(pool, config, sendResetMail) {
  const dummyHash = bcrypt.hashSync(
    'SQLiShield-non-account-password',
    config.hashRounds
  );
  let transport;
  async function mail(to, link) {
    if (sendResetMail) return sendResetMail({ to, link });
    if (!config.smtp)
      throw new HttpError(
        503,
        'Password recovery is not configured. Contact your service administrator.'
      );
    transport ||= nodemailer.createTransport({
      ...config.smtp,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
    await transport.sendMail({
      from: config.smtp.from,
      to,
      subject: 'Reset your SQLiShield password',
      text: `Use this link within 30 minutes to reset your SQLiShield password:\n\n${link}\n\nIf you did not request this, ignore this email.`,
    });
  }
  return {
    async register({ service_name, full_name, email, password }) {
      const passwordHash = await bcrypt.hash(password, config.hashRounds);
      return transaction(pool, async (client) => {
        const service = (
          await client.query(
            "INSERT INTO services(name,mode,strictness) VALUES($1,'hybrid','normal') RETURNING id,name,created_at",
            [service_name]
          )
        ).rows[0];
        const user = (
          await client.query(
            "INSERT INTO users(full_name,email,password_hash,role,service_id) VALUES($1,$2,$3,'admin',$4) RETURNING id,full_name,email,role,service_id",
            [full_name, email, passwordHash, service.id]
          )
        ).rows[0];
        await client.query(
          'INSERT INTO service_metrics(service_id) VALUES($1)',
          [service.id]
        );
        return { user, service: { ...service, service_name: service.name } };
      });
    },
    async login(email, password) {
      const user = (
        await pool.query(
          'SELECT u.*,s.is_active AS service_active FROM users u JOIN services s ON s.id=u.service_id WHERE LOWER(u.email)=$1',
          [email]
        )
      ).rows[0];
      const matched = await bcrypt.compare(
        password,
        user?.password_hash || dummyHash
      );
      requireThat(
        matched && user?.is_active && user?.service_active,
        'Invalid email or password.',
        401
      );
      const jti = randomUUID();
      const token = jwt.sign({}, config.jwtSecret, {
        algorithm: 'HS256',
        subject: String(user.id),
        jwtid: jti,
        expiresIn: config.sessionSeconds,
        issuer: 'SQLiShield',
        audience: 'SQLiShieldDashboard',
      });
      await pool.query(
        "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+$3 * INTERVAL '1 second')",
        [hashToken(jti), user.id, config.sessionSeconds]
      );
      return token;
    },
    async authenticate(token) {
      let claims;
      try {
        claims = jwt.verify(token, config.jwtSecret, {
          algorithms: ['HS256'],
          issuer: 'SQLiShield',
          audience: 'SQLiShieldDashboard',
        });
      } catch {
        throw new HttpError(
          401,
          'Invalid or expired session. Please sign in again.'
        );
      }
      requireThat(
        typeof claims.sub === 'string' && typeof claims.jti === 'string',
        'Invalid session.',
        401
      );
      const tokenHash = hashToken(claims.jti);
      const row = (
        await pool.query(
          'SELECT u.id,u.full_name,u.email,u.role,u.service_id,s.name AS service_name FROM sessions t JOIN users u ON u.id=t.user_id JOIN services s ON s.id=u.service_id WHERE t.token_hash=$1 AND t.user_id=$2 AND t.expires_at>NOW() AND u.is_active=TRUE AND s.is_active=TRUE AND u.service_id>0',
          [tokenHash, claims.sub]
        )
      ).rows[0];
      requireThat(
        row,
        'Invalid or expired session. Please sign in again.',
        401
      );
      return {
        user: publicUser(row),
        service: { id: row.service_id, service_name: row.service_name },
        tokenHash,
      };
    },
    async logout(tokenHash) {
      await pool.query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash]);
    },
    async forgotPassword(email) {
      if (!sendResetMail && !config.smtp)
        throw new HttpError(
          503,
          'Password recovery is not configured. Contact your service administrator.'
        );
      const user = (
        await pool.query(
          'SELECT id FROM users WHERE LOWER(email)=$1 AND is_active=TRUE',
          [email]
        )
      ).rows[0];
      if (!user) return;
      const raw = randomBytes(32).toString('hex');
      const tokenHash = hashToken(raw);
      await transaction(pool, async (client) => {
        await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [
          user.id,
        ]);
        await client.query(
          'DELETE FROM password_reset_tokens WHERE user_id=$1',
          [user.id]
        );
        await client.query(
          "INSERT INTO password_reset_tokens(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 minutes')",
          [tokenHash, user.id]
        );
      });
      try {
        await mail(email, `${config.frontendUrl}/reset-password?token=${raw}`);
      } catch {
        await pool.query(
          'DELETE FROM password_reset_tokens WHERE token_hash=$1',
          [tokenHash]
        );
        throw new HttpError(
          503,
          'Password recovery is temporarily unavailable. Please try again later.'
        );
      }
    },
    async resetPassword(token, password) {
      const tokenHash = hashToken(token);
      const record = (
        await pool.query(
          'SELECT user_id FROM password_reset_tokens WHERE token_hash=$1 AND expires_at>NOW()',
          [tokenHash]
        )
      ).rows[0];
      requireThat(record, 'The reset link is invalid or has expired.', 400);
      const passwordHash = await bcrypt.hash(password, config.hashRounds);
      return transaction(pool, async (client) => {
        await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [
          record.user_id,
        ]);
        const deleted = await client.query(
          'DELETE FROM password_reset_tokens WHERE token_hash=$1 AND expires_at>NOW() RETURNING user_id',
          [tokenHash]
        );
        requireThat(
          deleted.rowCount,
          'The reset link is invalid or has expired.',
          400
        );
        await client.query(
          'UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2',
          [passwordHash, record.user_id]
        );
        await client.query('DELETE FROM sessions WHERE user_id=$1', [
          record.user_id,
        ]);
        await client.query(
          'DELETE FROM password_reset_tokens WHERE user_id=$1',
          [record.user_id]
        );
        return record.user_id;
      });
    },
    async changePassword(userId, currentPassword, password) {
      const passwordHash = await bcrypt.hash(password, config.hashRounds);
      await transaction(pool, async (client) => {
        const current = (
          await client.query(
            'SELECT password_hash FROM users WHERE id=$1 AND is_active=TRUE FOR UPDATE',
            [userId]
          )
        ).rows[0];
        requireThat(
          current &&
            (await bcrypt.compare(currentPassword, current.password_hash)),
          'Your current password is incorrect.',
          400
        );
        requireThat(
          currentPassword !== password,
          'Choose a password different from your current password.'
        );
        await client.query(
          'UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2',
          [passwordHash, userId]
        );
        await client.query('DELETE FROM sessions WHERE user_id=$1', [userId]);
        await client.query(
          'DELETE FROM password_reset_tokens WHERE user_id=$1',
          [userId]
        );
      });
    },
    close() {
      transport?.close();
    },
  };
}
