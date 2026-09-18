/**
 * Money handling.
 *
 * Two units, both integers, never floats:
 *   - PAISA — PKR x 100. Rs 2,317.00 is 231700.
 *   - FEN   — CNY x 100. ¥28.00 is 2800.
 *
 * Floats lose fractions of a rupee and the loss compounds across orders, so
 * arithmetic happens in integers and rounding happens exactly once, at the
 * point a number is produced for display or storage.
 */

export type Paisa = number;
export type Fen = number;

export interface PricingSettings {
  cnyToPkr: number;
  markup: number;
  depositPercent: number;
}

/** Supplier cost (fen) -> our cost in paisa, at the current rate. */
export function costToPaisa(costFen: Fen, cnyToPkr: number): Paisa {
  return Math.round((costFen / 100) * cnyToPkr * 100);
}

/**
 * Supplier cost -> shelf price. This is the x2 rule: freight, duty and profit
 * all sit inside the markup, so there is no separate landed-cost step.
 *
 * Rounded to the nearest whole rupee, not up. Rounding up would gain at most
 * 99 paisa per unit while putting every price 1 rupee above the figures in the
 * exported CSVs and the approved designs — and this number is a suggested
 * starting price that gets edited by hand before publishing anyway.
 */
export function sellPriceFromCost(costFen: Fen, s: PricingSettings): Paisa {
  const raw = (costFen / 100) * s.cnyToPkr * s.markup;
  return Math.round(raw) * 100;
}

/**
 * Deposit for an order total. Rounded to the nearest rupee: the balance is
 * always computed as total - paid, so however this rounds, the balance absorbs
 * it and no money goes missing.
 */
export function depositFor(totalPaisa: Paisa, depositPercent: number): Paisa {
  return Math.round((totalPaisa * depositPercent) / 100 / 100) * 100;
}

/** What is still owed. Never negative — an overpayment is a refund, not a credit. */
export function balanceOf(totalPaisa: Paisa, paidPaisa: Paisa): Paisa {
  return Math.max(0, totalPaisa - paidPaisa);
}

/**
 * The highest supplier price (in fen) we can pay and still land at or under a
 * given market price. This is the buy target used across the sourcing work.
 */
export function maxCostFen(marketPaisa: Paisa, s: PricingSettings): Fen {
  const cny = marketPaisa / 100 / s.markup / s.cnyToPkr;
  return Math.floor(cny * 100);
}

/** "Rs 2,317" — no decimals, because nothing here is priced in paisa. */
export function formatPkr(paisa: Paisa, opts: { symbol?: boolean } = {}): string {
  const { symbol = true } = opts;
  const rupees = Math.round(paisa / 100);
  const formatted = rupees.toLocaleString("en-US");
  return symbol ? `Rs ${formatted}` : formatted;
}

/** "¥28" or "¥28.50" — supplier prices do carry cents. */
export function formatCny(fen: Fen): string {
  const yuan = fen / 100;
  return `¥${yuan % 1 === 0 ? yuan.toFixed(0) : yuan.toFixed(2)}`;
}

/** "Rs 2,317 – Rs 2,730", collapsing to one value when the range is flat. */
export function formatPkrRange(lo: Paisa, hi: Paisa): string {
  return lo === hi ? formatPkr(lo) : `${formatPkr(lo)} – ${formatPkr(hi)}`;
}

export function parseRupeesToPaisa(input: string): Paisa | null {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
