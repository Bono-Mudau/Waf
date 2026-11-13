import bcrypt from 'bcryptjs';
import { transaction } from '../../db/dbConfig.js';
import { requireThat } from '../middleware/errors.js';
import { publicUser } from './authServices.js';

export function createUserService(pool, config) {
  async function lockService(client, serviceId) {
    await client.query('SELECT id FROM services WHERE id=$1 FOR UPDATE', [
      serviceId,
    ]);
  }
  async function target(client, serviceId, userId) {
    const row = (
      await client.query(
        'SELECT * FROM users WHERE id=$1 AND service_id=$2 FOR UPDATE',
        [userId, serviceId]
      )
    ).rows[0];
    requireThat(row, 'Member not found.', 404);
    return row;
  }
  async function protectLastAdmin(client, row, newRole) {
    if (row.role === 'admin' && newRole !== 'admin') {
      const count = (
        await client.query(
          "SELECT COUNT(*) FROM users WHERE service_id=$1 AND role='admin' AND is_active=TRUE AND id<>$2",
          [row.service_id, row.id]
        )
      ).rows[0].count;
      requireThat(
        Number(count) > 0,
        'Assign another administrator before removing or demoting the last administrator.',
        409
      );
    }
  }
  return {
    async list(serviceId) {
      return (
        await pool.query(
          'SELECT id,full_name,email,role,service_id FROM users WHERE service_id=$1 ORDER BY id',
          [serviceId]
        )
      ).rows;
    },
    async create(serviceId, body) {
      const passwordHash = await bcrypt.hash(body.password, config.hashRounds);
      return transaction(pool, async (client) => {
        await lockService(client, serviceId);
        return (
          await client.query(
            'INSERT INTO users(full_name,email,role,password_hash,service_id) VALUES($1,$2,$3,$4,$5) RETURNING id,full_name,email,role,service_id',
            [body.full_name, body.email, body.role, passwordHash, serviceId]
          )
        ).rows[0];
      });
    },
    async update(serviceId, userId, body) {
      return transaction(pool, async (client) => {
        await lockService(client, serviceId);
        await target(client, serviceId, userId);
        return (
          await client.query(
            'UPDATE users SET full_name=$1,email=$2,updated_at=NOW() WHERE id=$3 AND service_id=$4 RETURNING id,full_name,email,role,service_id',
            [body.full_name, body.email, userId, serviceId]
          )
        ).rows[0];
      });
    },
    async role(serviceId, userId, newRole) {
      return transaction(pool, async (client) => {
        await lockService(client, serviceId);
        const row = await target(client, serviceId, userId);
        await protectLastAdmin(client, row, newRole);
        const updated = (
          await client.query(
            'UPDATE users SET role=$1,updated_at=NOW() WHERE id=$2 AND service_id=$3 RETURNING id,full_name,email,role,service_id',
            [newRole, userId, serviceId]
          )
        ).rows[0];
        await client.query('DELETE FROM sessions WHERE user_id=$1', [userId]);
        return updated;
      });
    },
    async remove(serviceId, userId) {
      await transaction(pool, async (client) => {
        await lockService(client, serviceId);
        const row = await target(client, serviceId, userId);
        await protectLastAdmin(client, row, null);
        await client.query('DELETE FROM users WHERE id=$1 AND service_id=$2', [
          userId,
          serviceId,
        ]);
      });
    },
    publicUser,
  };
}
