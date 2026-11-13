import { randomBytes } from 'node:crypto';
import { transaction } from '../../db/dbConfig.js';
import { hashToken } from './authServices.js';
import { requireThat } from '../middleware/errors.js';

export function createServiceService(pool) {
  return {
    async get(serviceId, isAdmin = false) {
      const service = (
        await pool.query(
          'SELECT id,name,description,base_url,mode,strictness,created_at FROM services WHERE id=$1 AND is_active=TRUE',
          [serviceId]
        )
      ).rows[0];
      requireThat(service, 'Service not found.', 404);
      if (isAdmin)
        service.api_keys = (
          await pool.query(
            'SELECT id,key_prefix,name,is_active,created_at,expires_at,last_used_at FROM api_keys WHERE service_id=$1 ORDER BY id DESC',
            [serviceId]
          )
        ).rows;
      return { ...service, service_name: service.name };
    },
    async update(serviceId, name) {
      return (
        await pool.query(
          'UPDATE services SET name=$1,updated_at=NOW() WHERE id=$2 RETURNING id,name AS service_name',
          [name, serviceId]
        )
      ).rows[0];
    },
    async createKey(serviceId, rotate = false) {
      const raw = `sqlishield_${randomBytes(32).toString('hex')}`;
      return transaction(pool, async (client) => {
        await client.query('SELECT id FROM services WHERE id=$1 FOR UPDATE', [
          serviceId,
        ]);
        if (rotate)
          await client.query(
            'UPDATE api_keys SET is_active=FALSE WHERE service_id=$1',
            [serviceId]
          );
        const count = (
          await client.query(
            'SELECT COUNT(*) FROM api_keys WHERE service_id=$1 AND is_active=TRUE',
            [serviceId]
          )
        ).rows[0].count;
        requireThat(
          Number(count) < 5,
          'Revoke an existing API key before creating another.',
          409
        );
        const key = (
          await client.query(
            'INSERT INTO api_keys(service_id,key_prefix,key_hash) VALUES($1,$2,$3) RETURNING id,key_prefix,created_at',
            [serviceId, raw.slice(0, 21), hashToken(raw)]
          )
        ).rows[0];
        return { ...key, api_key: raw };
      });
    },
    async revokeKey(serviceId, keyId) {
      const result = await pool.query(
        'UPDATE api_keys SET is_active=FALSE WHERE id=$1 AND service_id=$2 RETURNING id',
        [keyId, serviceId]
      );
      requireThat(result.rowCount, 'API key not found.', 404);
    },
    async authenticateKey(raw) {
      requireThat(
        typeof raw === 'string' && /^sqlishield_[a-f0-9]{64}$/.test(raw),
        'A valid service API key is required.',
        401
      );
      const key = (
        await pool.query(
          'SELECT k.id,k.service_id FROM api_keys k JOIN services s ON s.id=k.service_id WHERE k.key_hash=$1 AND k.is_active=TRUE AND (k.expires_at IS NULL OR k.expires_at>NOW()) AND s.is_active=TRUE AND s.id>0',
          [hashToken(raw)]
        )
      ).rows[0];
      requireThat(key, 'Invalid or revoked service API key.', 401);
      await pool.query(
        "UPDATE api_keys SET last_used_at=NOW() WHERE id=$1 AND (last_used_at IS NULL OR last_used_at<NOW()-INTERVAL '1 minute')",
        [key.id]
      );
      return key;
    },
  };
}
