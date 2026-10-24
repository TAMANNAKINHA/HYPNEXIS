/** Format a number as Indian Rupees with Indian digit grouping (lakh/crore). */
export function formatINR(amount: number): string {
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
  return formatted;
}

/** Format without the currency symbol — just the grouped digits. */
export function formatINRNumber(amount: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount);
}