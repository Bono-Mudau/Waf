const sensitive =
  /(?:password|passwd|authorization|cookie|token|secret|api[-_]?key)/i;
export function redact(value, depth = 0) {
  if (depth > 8) return '[Nested data omitted]';
  if (typeof value === 'string')
    return value.length > 4096 ? `${value.slice(0, 4096)}…` : value;
  if (Array.isArray(value))
    return value.slice(0, 100).map((item) => redact(item, depth + 1));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([key, item]) => [
          key,
          sensitive.test(key) ? '[REDACTED]' : redact(item, depth + 1),
        ])
    );
  return value;
}
