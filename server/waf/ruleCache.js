export class RuleCache {
  constructor(repository, ttl = 30000) {
    this.repository = repository;
    this.ttl = ttl;
    this.entries = new Map();
  }
  async getRules(serviceId) {
    const entry = this.entries.get(String(serviceId));
    if (entry && entry.expires > Date.now()) return entry.rules;
    const rules = await this.repository.getRulesForService(serviceId);
    this.entries.set(String(serviceId), {
      rules,
      expires: Date.now() + this.ttl,
    });
    return rules;
  }
  clear(serviceId) {
    if (serviceId === undefined) this.entries.clear();
    else this.entries.delete(String(serviceId));
  }
}
