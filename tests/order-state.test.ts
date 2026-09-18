import { describe, it, expect } from "vitest";
import {
  ORDER_STATES, canTransition, nextStates, isTerminal, assertTransition,
  IllegalTransition, STATE_META, AWAITING_MONEY, WITH_SUPPLIER,
  type OrderState,
} from "@/lib/order-state";

describe("the happy path", () => {
  it("runs deposit -> supplier -> transit -> balance -> dispatched", () => {
    const path: OrderState[] = [
      "AWAITING_DEPOSIT", "DEPOSIT_PAID", "ORDERED_FROM_SUPPLIER",
      "IN_TRANSIT", "BALANCE_DUE", "DISPATCHED",
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1]), `${path[i]} -> ${path[i + 1]}`).toBe(true);
    }
  });

  it("lets a fully prepaid order skip BALANCE_DUE", () => {
    expect(canTransition("IN_TRANSIT", "DISPATCHED")).toBe(true);
  });
});

describe("illegal moves are refused", () => {
  it("cannot dispatch before the goods are ordered", () => {
    expect(canTransition("AWAITING_DEPOSIT", "DISPATCHED")).toBe(false);
    expect(canTransition("DEPOSIT_PAID", "DISPATCHED")).toBe(false);
  });

  it("cannot order from the supplier before the deposit clears", () => {
    expect(canTransition("AWAITING_DEPOSIT", "ORDERED_FROM_SUPPLIER")).toBe(false);
  });

  it("cannot go backwards", () => {
    expect(canTransition("DISPATCHED", "IN_TRANSIT")).toBe(false);
    expect(canTransition("IN_TRANSIT", "DEPOSIT_PAID")).toBe(false);
    expect(canTransition("DEPOSIT_PAID", "AWAITING_DEPOSIT")).toBe(false);
  });

  it("cannot leave a terminal state", () => {
    for (const s of ["CANCELLED", "REFUNDED"] as OrderState[]) {
      expect(isTerminal(s)).toBe(true);
      expect(nextStates(s)).toHaveLength(0);
    }
  });

  it("cannot transition to itself", () => {
    for (const s of ORDER_STATES) expect(canTransition(s, s)).toBe(false);
  });

  it("throws, rather than returning false, when asserted", () => {
    expect(() => assertTransition("AWAITING_DEPOSIT", "DISPATCHED")).toThrow(IllegalTransition);
    expect(() => assertTransition("AWAITING_DEPOSIT", "DEPOSIT_PAID")).not.toThrow();
  });

  it("names the allowed moves in the error, so the message is actionable", () => {
    try {
      assertTransition("AWAITING_DEPOSIT", "DISPATCHED");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as Error).message).toContain("DEPOSIT_PAID");
      expect((e as Error).message).toContain("CANCELLED");
    }
  });
});

describe("cancelling and refunding", () => {
  it("can cancel while no goods have shipped", () => {
    for (const s of ["AWAITING_DEPOSIT", "DEPOSIT_PAID", "ORDERED_FROM_SUPPLIER"] as OrderState[]) {
      expect(canTransition(s, "CANCELLED")).toBe(true);
    }
  });

  it("cannot cancel once the goods are moving — that is a refund", () => {
    for (const s of ["IN_TRANSIT", "BALANCE_DUE", "DISPATCHED"] as OrderState[]) {
      expect(canTransition(s, "CANCELLED")).toBe(false);
      expect(canTransition(s, "REFUNDED")).toBe(true);
    }
  });

  it("cannot refund an order that never paid", () => {
    expect(canTransition("AWAITING_DEPOSIT", "REFUNDED")).toBe(false);
  });
});

describe("the map is complete and internally consistent", () => {
  it("declares every state", () => {
    for (const s of ORDER_STATES) {
      expect(nextStates(s), `${s} has no entry`).toBeDefined();
      expect(STATE_META[s], `${s} has no display metadata`).toBeDefined();
    }
  });

  it("only points at states that exist", () => {
    for (const s of ORDER_STATES) {
      for (const to of nextStates(s)) expect(ORDER_STATES).toContain(to);
    }
  });

  it("can reach every non-initial state from AWAITING_DEPOSIT", () => {
    const seen = new Set<OrderState>(["AWAITING_DEPOSIT"]);
    const queue: OrderState[] = ["AWAITING_DEPOSIT"];
    while (queue.length) {
      for (const to of nextStates(queue.shift()!)) {
        if (!seen.has(to)) { seen.add(to); queue.push(to); }
      }
    }
    for (const s of ORDER_STATES) expect(seen.has(s), `${s} is unreachable`).toBe(true);
  });

  it("gives every state that needs action an action label", () => {
    for (const s of AWAITING_MONEY) expect(STATE_META[s].action).not.toBe("");
  });

  it("groups the waiting-on-money and with-supplier states correctly", () => {
    expect(AWAITING_MONEY).toEqual(["AWAITING_DEPOSIT", "BALANCE_DUE"]);
    expect(WITH_SUPPLIER).toEqual(["ORDERED_FROM_SUPPLIER", "IN_TRANSIT"]);
  });

  it("increases progress along the happy path", () => {
    const path: OrderState[] = ["AWAITING_DEPOSIT", "DEPOSIT_PAID", "IN_TRANSIT", "BALANCE_DUE", "DISPATCHED"];
    for (let i = 1; i < path.length; i++) {
      expect(STATE_META[path[i]].progress).toBeGreaterThan(STATE_META[path[i - 1]].progress);
    }
  });
});
