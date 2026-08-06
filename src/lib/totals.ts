/**
 * Shared line-item math for estimates and invoices. No tax handling yet (see
 * spec: tax is out of scope for v1) — total is just the sum of line amounts.
 */

export function computeLineAmount(quantity: number, rate: number) {
  return quantity * rate;
}

export function computeTotals(lines: { quantity: number; rate: number }[]) {
  const subtotal = lines.reduce((sum, l) => sum + computeLineAmount(l.quantity, l.rate), 0);
  return { subtotal, total: subtotal };
}
