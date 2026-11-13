class HeuristicEngine {
  findSqlKeywords(value) {
    return [
      'select',
      'union',
      'insert',
      'update',
      'delete',
      'drop',
      'from',
      'where',
      'having',
      'order by',
      'group by',
    ].filter((keyword) =>
      new RegExp(`\\b${keyword.replace(' ', '\\s+')}\\b`, 'i').test(value)
    );
  }
  detectTautology(value) {
    for (const match of value.matchAll(/\b(?:or|and)\s+(\d+)\s*=\s*(\d+)\b/gi))
      if (
        match[1].replace(/^0+(?=\d)/, '') === match[2].replace(/^0+(?=\d)/, '')
      )
        return true;
    for (const match of value.matchAll(
      /\b(?:or|and)\s+(['"])([^'"]{0,100})\1\s*=\s*(['"])([^'"]{0,100})\3/gi
    ))
      if (match[2] === match[4]) return true;
    return false;
  }
  detectSqlComments(value) {
    return /--(?:\s|$)|\/\*|(?:['"]|\b(?:or|and|select|union)\b)\s*#/.test(
      value
    );
  }
  detectTimeBased(value) {
    return /\b(?:sleep\s*\(|benchmark\s*\(|pg_sleep\s*\(|waitfor\s+delay\b)/i.test(
      value
    );
  }
  evaluate(values) {
    let score = 0;
    const indicators = [];
    for (const item of values) {
      for (const [matched, type, points] of [
        [this.detectSqlComments(item.value), 'sql_comment', 10],
        [this.detectTautology(item.value), 'tautology', 15],
        [this.detectTimeBased(item.value), 'time_based', 20],
        [true, 'sql_keyword', this.findSqlKeywords(item.value).length * 1.5],
      ])
        if (matched && points) {
          score += points;
          indicators.push({
            type,
            score: points,
            source: item.source,
            key: item.key,
          });
        }
    }
    return { score, indicators };
  }
}
export default new HeuristicEngine();
