export class RuleRepository {
  constructor(pool) {
    this.pool = pool;
  }
  async getDefaultRules() {
    return this.getRulesForService(0);
  }
  async getRulesForService(serviceId) {
    return (
      await this.pool.query(
        'SELECT id,service_id,name,pattern,match_type,match_type AS "matchType",score,enabled FROM rules WHERE enabled=TRUE AND (service_id=0 OR service_id=$1) ORDER BY id',
        [serviceId]
      )
    ).rows;
  }
}
