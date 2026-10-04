/** Round before assigning a sign or colour, so a displayed zero is always neutral. */
export function roundedChange(value: number, digits: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits)) || 0;
}

export function signedChange(value: number, digits = 1): string {
  const rounded = roundedChange(value, digits);
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(digits)}`;
}

export function changeColor(value: number, digits = 1): string {
  const rounded = roundedChange(value, digits);
  return rounded > 0 ? 'var(--color-gain)' : rounded < 0 ? 'var(--color-loss)' : 'var(--text-secondary)';
}
