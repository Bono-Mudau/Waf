import { transaction } from '../../db/dbConfig.js';
import { requireThat } from '../middleware/errors.js';

export function createRuleService(pool, cache) {
  return {
    async list(serviceId) {
      return (
        await pool.query(
          'SELECT id,service_id,name,description,pattern,match_type,score,enabled,created_at FROM rules WHERE service_id=0 OR service_id=$1 ORDER BY service_id,id',
          [serviceId]
        )
      ).rows;
    },
    async create(serviceId, body) {
      const rule = await transaction(pool, async (client) => {
        await client.query('SELECT id FROM services WHERE id=$1 FOR UPDATE', [
          serviceId,
        ]);
        const count = (
          await client.query('SELECT COUNT(*) FROM rules WHERE service_id=$1', [
            serviceId,
          ])
        ).rows[0].count;
        requireThat(
          Number(count) < 100,
          'A service can have at most 100 custom rules.',
          409
        );
        return (
          await client.query(
            'INSERT INTO rules(service_id,name,description,pattern,match_type,score,enabled) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
            [
              serviceId,
              body.name,
              body.description,
              body.pattern,
              body.match_type,
              body.score,
              body.enabled,
            ]
          )
        ).rows[0];
      });
      cache.clear(serviceId);
      return rule;
    },
    async update(serviceId, ruleId, body) {
      const keys = Object.keys(body);
      const values = keys.map((key) => body[key]);
      // Identifiers come only from the controller's explicit field whitelist.
      const fields = keys
        .map((key, index) => `"${key}"=$${index + 1}`)
        .join(',');
      const result = await transaction(pool, async (client) => {
        const current = (
          await client.query(
            'SELECT * FROM rules WHERE id=$1 AND service_id=$2 AND service_id>0 FOR UPDATE',
            [ruleId, serviceId]
          )
        ).rows[0];
        requireThat(
          current,
          'Custom rule not found, or this is a shared default rule.',
          404
        );
        const candidate = { ...current, ...body };
        if (candidate.match_type === 'regex') {
          try {
            new RegExp(candidate.pattern, 'i');
          } catch {
            requireThat(false, 'Invalid regular expression.');
          }
        }
        return client.query(
          `UPDATE rules SET ${fields},updated_at=NOW() WHERE id=$${keys.length + 1} AND service_id=$${keys.length + 2} AND service_id>0 RETURNING *`,
          [...values, ruleId, serviceId]
        );
      });
      requireThat(
        result.rowCount,
        'Custom rule not found, or this is a shared default rule.',
        404
      );
      cache.clear(serviceId);
      return result.rows[0];
    },
    async remove(serviceId, ruleId) {
      const result = await pool.query(
        'DELETE FROM rules WHERE id=$1 AND service_id=$2 AND service_id>0 RETURNING id',
        [ruleId, serviceId]
      );
      requireThat(
        result.rowCount,
        'Custom rule not found, or this is a shared default rule.',
        404
      );
      cache.clear(serviceId);
    },
  };
}
