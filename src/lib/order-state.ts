/**
 * Order state machine.
 *
 * Every transition an order may make is declared here. Nothing else in the app
 * decides what is legal — call `canTransition` before writing, and write the
 * OrderEvent row in the same transaction as the state change.
 *
 * Money states come before logistics states on purpose: we do not place the
 * supplier order until the deposit has actually been verified.
 */

export const ORDER_STATES = [
  "AWAITING_DEPOSIT",
  "DEPOSIT_PAID",
  "ORDERED_FROM_SUPPLIER",
  "IN_TRANSIT",
  "BALANCE_DUE",
  "DISPATCHED",
  "CANCELLED",
  "REFUNDED",
] as const;

export type OrderState = (typeof ORDER_STATES)[number];

/** Allowed next states, keyed by current state. */
const TRANSITIONS: Record<OrderState, readonly OrderState[]> = {
  AWAITING_DEPOSIT: ["DEPOSIT_PAID", "CANCELLED"],
  // A fully-prepaid order still passes through DEPOSIT_PAID; "deposit" just
  // means "enough money cleared to buy from the supplier".
  DEPOSIT_PAID: ["ORDERED_FROM_SUPPLIER", "CANCELLED", "REFUNDED"],
  ORDERED_FROM_SUPPLIER: ["IN_TRANSIT", "CANCELLED", "REFUNDED"],
  IN_TRANSIT: ["BALANCE_DUE", "DISPATCHED", "REFUNDED"],
  // BALANCE_DUE is skipped when the order was paid in full up front.
  BALANCE_DUE: ["DISPATCHED", "REFUNDED"],
  DISPATCHED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransition(from: OrderState, to: OrderState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStates(from: OrderState): readonly OrderState[] {
  return TRANSITIONS[from];
}

export function isTerminal(state: OrderState): boolean {
  return TRANSITIONS[state].length === 0;
}

/** Thrown rather than returned, so an illegal write can never be ignored. */
export class IllegalTransition extends Error {
  constructor(from: OrderState, to: OrderState) {
    super(
      `Cannot move an order from ${from} to ${to}. ` +
        `Allowed: ${TRANSITIONS[from].join(", ") || "none — this state is final"}.`
    );
    this.name = "IllegalTransition";
  }
}

export function assertTransition(from: OrderState, to: OrderState): void {
  if (!canTransition(from, to)) throw new IllegalTransition(from, to);
}

// ---------------------------------------------------------------- display

interface StateMeta {
  label: string;
  /** What the shop owner should do next. Empty when the ball is elsewhere. */
  action: string;
  tone: "danger" | "warn" | "info" | "neutral" | "good";
  /** Rough share of the money journey, for the progress bar. */
  progress: number;
}

export const STATE_META: Record<OrderState, StateMeta> = {
  AWAITING_DEPOSIT: {
    label: "Awaiting deposit",
    action: "Chase the customer",
    tone: "danger",
    progress: 0,
  },
  DEPOSIT_PAID: {
    label: "Deposit paid",
    action: "Order from the supplier",
    tone: "info",
    progress: 30,
  },
  ORDERED_FROM_SUPPLIER: {
    label: "Ordered from supplier",
    action: "",
    tone: "info",
    progress: 40,
  },
  IN_TRANSIT: { label: "In transit", action: "", tone: "neutral", progress: 60 },
  BALANCE_DUE: {
    label: "Balance due",
    action: "Collect the balance",
    tone: "warn",
    progress: 75,
  },
  DISPATCHED: { label: "Dispatched", action: "", tone: "good", progress: 100 },
  CANCELLED: { label: "Cancelled", action: "", tone: "neutral", progress: 0 },
  REFUNDED: { label: "Refunded", action: "", tone: "neutral", progress: 0 },
};

/** States where we are waiting on the customer's money. */
export const AWAITING_MONEY: readonly OrderState[] = [
  "AWAITING_DEPOSIT",
  "BALANCE_DUE",
];

/** States where the goods are somewhere between the supplier and us. */
export const WITH_SUPPLIER: readonly OrderState[] = [
  "ORDERED_FROM_SUPPLIER",
  "IN_TRANSIT",
];
