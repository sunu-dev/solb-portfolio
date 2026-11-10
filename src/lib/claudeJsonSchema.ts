/** Raw Anthropic JSON schemas reject length/array bounds. Application validators retain those checks. */
export function claudeJsonSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const convert = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(convert);
    if (!value || typeof value !== 'object') return value;
    const result: Record<string, unknown> = {}, constraints: string[] = [];
    for (const [key, item] of Object.entries(value)) {
      if (['minLength', 'maxLength', 'minItems', 'maxItems'].includes(key)) constraints.push(`${key}: ${item}`);
      else result[key] = convert(item);
    }
    if (constraints.length) result.description = [result.description, ...constraints].filter(Boolean).join('; ');
    return result;
  };
  return convert(schema) as Record<string, unknown>;
}
