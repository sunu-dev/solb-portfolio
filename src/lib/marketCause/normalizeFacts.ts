import { createHash } from 'node:crypto';
import type { FactInput, NormalizedFact, SourceDocument } from './types';

export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** JSONB may reorder object keys. Evidence signatures must survive storage. */
export function canonicalDigest(value: unknown): string {
  const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical)
    : v !== null && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canonical(x)])) : v;
  return digest(canonical(value));
}
export const documentHash = (cells: Record<string, string>) => digest(Object.entries(cells).sort(([a], [b]) => a.localeCompare(b)));
/** Decimal arithmetic only; never silently round large financial amounts through Number. */
export function decimal(raw: string, scale = 0): string {
  if (!Number.isInteger(scale) || scale < 0 || scale > 12 || typeof raw !== 'string' || raw.length > 80
    || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw)) throw new Error('invalid_decimal');
  const negative = raw.startsWith('-');
  const [whole, fraction = ''] = raw.replace(/^-/, '').split('.');
  if (fraction.length > 12 || whole.length > 30) throw new Error('decimal_limit');
  const digits = whole + fraction;
  const position = whole.length + scale;
  const shifted = position >= digits.length ? digits.padEnd(position, '0') : `${digits.slice(0, position)}.${digits.slice(position)}`;
  const [a, b = ''] = shifted.split('.');
  const integer = a.replace(/^0+(?=\d)/, ''); const tail = b.replace(/0+$/, '');
  if (integer.length > 30) throw new Error('decimal_limit');
  const result = integer + (tail ? `.${tail}` : '');
  return negative && result !== '0' ? `-${result}` : result;
}
export function compareDecimal(a: string, b: string): number {
  const left = decimal(a); const right = decimal(b);
  const precision = Math.max(left.split('.')[1]?.length ?? 0, right.split('.')[1]?.length ?? 0);
  const asInteger = (v: string) => { const [whole, fraction = ''] = v.split('.'); return BigInt(whole + fraction.padEnd(precision, '0')); };
  const l = asInteger(left); const r = asInteger(right);
  return l < r ? -1 : l > r ? 1 : 0;
}
export function validDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}
export function instant(value: string): number {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && validDay(value.slice(0, 10)) && Number(value.slice(11,13)) < 24
    && Number(value.slice(14,16)) < 60 && Number(value.slice(17,19)) < 60 ? Date.parse(value) : NaN;
}
const units = {
  revenue: ['USD', 'KRW'], net_income: ['USD', 'KRW'], operating_cash_flow: ['USD', 'KRW'],
  capital_expenditure: ['USD', 'KRW'], eps: ['USD/share'], policy_rate: ['percent'],
};
export function normalizeFact(input: FactInput, document: SourceDocument): NormalizedFact {
  if (!input.id || !input.entityId || !input.definition || input.scope !== 'consolidated'
    || !units[input.metric]?.includes(input.unit) || ![0, 3, 6, 8, 9, 12].includes(input.scale)
    || !['actual', 'consensus', 'guidance'].includes(input.role)
    || !['gaap', 'adjusted', 'not_applicable'].includes(input.basis)) throw new Error('invalid_fact');
  if (!validDay(input.periodStart) || !validDay(input.periodEnd) || input.periodStart > input.periodEnd) throw new Error('invalid_period');
  if (input.documentId !== document.id || document.hash !== documentHash(document.cells)
    || !Object.hasOwn(document.cells, input.locator) || document.cells[input.locator] !== input.rawValue) throw new Error('evidence_mismatch');
  const value = decimal(input.rawValue, input.scale);
  return { ...input, value, provenanceHash: canonicalDigest([document.hash, input, value]) };
}
/** Recompute rather than trusting normalized values supplied at a boundary. */
export function hasValidProvenance(fact: NormalizedFact, document: SourceDocument): boolean {
  try {
    const { value, provenanceHash, ...input } = fact;
    const checked = normalizeFact(input, document);
    return checked.value === value && checked.provenanceHash === provenanceHash;
  } catch { return false; }
}
