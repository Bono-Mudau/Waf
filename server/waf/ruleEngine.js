class RuleEngine {
  extractValues(value, source, key = '') {
    if (typeof value === 'string') return [{ source, key, value }];
    if (Array.isArray(value))
      return value.flatMap((item, index) =>
        this.extractValues(item, source, `${key}[${index}]`)
      );
    if (value && typeof value === 'object')
      return Object.entries(value).flatMap(([childKey, item]) =>
        this.extractValues(item, source, key ? `${key}.${childKey}` : childKey)
      );
    return [];
  }
  extractRequestValues(record) {
    return ['path', 'headers', 'query', 'body'].flatMap((source) =>
      this.extractValues(record[source], source)
    );
  }
  matchesRule(value, rule) {
    const kind = rule.matchType || rule.match_type;
    if (kind === 'keyword') return value.includes(rule.pattern.toLowerCase());
    if (kind === 'regex') return new RegExp(rule.pattern, 'i').test(value);
    return false;
  }
  evaluate(values, rules) {
    const matches = [];
    for (const value of values)
      for (const rule of rules)
        if (rule.enabled !== false && this.matchesRule(value.value, rule))
          matches.push({
            rule: { id: rule.id, name: rule.name, score: rule.score },
            source: value.source,
            key: value.key,
          });
    return matches;
  }
}
export default new RuleEngine();
