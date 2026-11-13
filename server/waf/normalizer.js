class Normalizer {
  decodeUrl(value) {
    let result = value;
    for (let index = 0; index < 4; index++) {
      try {
        const next = decodeURIComponent(result);
        if (next === result) break;
        result = next;
      } catch {
        break;
      }
    }
    return result;
  }
  normalizeString(value) {
    return this.decodeUrl(value)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }
  normalizeValue(value) {
    if (typeof value === 'string') return this.normalizeString(value);
    if (Array.isArray(value))
      return value.map((item) => this.normalizeValue(item));
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          this.normalizeValue(item),
        ])
      );
    return value;
  }
  normalize(record) {
    return {
      ...record,
      path: this.normalizeValue(record.path),
      headers: this.normalizeValue(record.headers),
      body: this.normalizeValue(record.body),
      query: this.normalizeValue(record.query),
    };
  }
}
export default new Normalizer();
