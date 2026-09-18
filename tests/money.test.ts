import { describe, it, expect } from "vitest";
import {
  sellPriceFromCost, costToPaisa, depositFor, balanceOf, maxCostFen,
  formatPkr, formatCny, formatPkrRange, parseRupeesToPaisa,
} from "@/lib/money";

const S = { cnyToPkr: 41.37, markup: 2.0, depositPercent: 30 };

describe("sellPriceFromCost — the x2 rule", () => {
  // Numbers taken from the real key-cover listing (offer 1057887564978).
  it.each([
    ["shell only",    2800,  "Rs 2,317"],
    ["round buckle",  3200,  "Rs 2,648"],
    ["metal buckle",  3200,  "Rs 2,648"],
    ["white strap",   3300,  "Rs 2,730"],
    ["black strap",   3300,  "Rs 2,730"],
  ])("%s at ¥%d -> %s", (_label, fen, want) => {
    expect(formatPkr(sellPriceFromCost(fen, S))).toBe(want);
  });

  it("matches the watch listing too", () => {
    expect(formatPkr(sellPriceFromCost(13500, S))).toBe("Rs 11,170");
    expect(formatPkr(sellPriceFromCost(14500, S))).toBe("Rs 11,997");
  });

  it("always lands on a whole rupee", () => {
    for (const fen of [1, 99, 2850, 3333, 99999]) {
      expect(sellPriceFromCost(fen, S) % 100).toBe(0);
    }
  });

  it("scales with the markup setting", () => {
    const at3 = sellPriceFromCost(2800, { ...S, markup: 3 });
    expect(formatPkr(at3)).toBe("Rs 3,475");
  });

  it("never returns a negative price", () => {
    expect(sellPriceFromCost(0, S)).toBe(0);
  });
});

describe("costToPaisa", () => {
  it("converts supplier cost at the current rate", () => {
    expect(formatPkr(costToPaisa(2800, S.cnyToPkr))).toBe("Rs 1,158");
    expect(formatPkr(costToPaisa(3300, S.cnyToPkr))).toBe("Rs 1,365");
  });

  it("tracks a rate change", () => {
    expect(formatPkr(costToPaisa(2800, 50))).toBe("Rs 1,400");
  });
});

describe("depositFor", () => {
  it("takes the configured percentage", () => {
    expect(formatPkr(depositFor(231700, 30))).toBe("Rs 695");
    expect(formatPkr(depositFor(273000, 30))).toBe("Rs 819");
  });

  it("handles 100% (a fully prepaid order)", () => {
    expect(depositFor(231700, 100)).toBe(231700);
  });

  it("handles 0%", () => {
    expect(depositFor(231700, 0)).toBe(0);
  });
});

describe("balanceOf", () => {
  it("subtracts what has been paid", () => {
    expect(formatPkr(balanceOf(273000, 81900))).toBe("Rs 1,911");
  });

  it("is zero once fully paid", () => {
    expect(balanceOf(273000, 273000)).toBe(0);
  });

  it("floors at zero — an overpayment is a refund, not a credit", () => {
    expect(balanceOf(273000, 300000)).toBe(0);
  });
});

describe("maxCostFen — sourcing buy targets", () => {
  it("is the most we can pay and still match the market", () => {
    expect(formatCny(maxCostFen(949900, S))).toBe("¥114.80");  // TPE floor mats
    expect(formatCny(maxCostFen(299900, S))).toBe("¥36.24");   // key covers
    expect(formatCny(maxCostFen(2849900, S))).toBe("¥344.44"); // side steps
  });

  it("round-trips: buying at the ceiling lands at or under market", () => {
    for (const market of [199900, 299900, 449900, 949900, 2849900]) {
      const ceiling = maxCostFen(market, S);
      expect(sellPriceFromCost(ceiling, S)).toBeLessThanOrEqual(market);
    }
  });
});

describe("formatting", () => {
  it("renders rupees without decimals", () => {
    expect(formatPkr(231700)).toBe("Rs 2,317");
    expect(formatPkr(231700, { symbol: false })).toBe("2,317");
    expect(formatPkr(0)).toBe("Rs 0");
  });

  it("renders yuan with cents only when needed", () => {
    expect(formatCny(2800)).toBe("¥28");
    expect(formatCny(2850)).toBe("¥28.50");
  });

  it("collapses a flat range", () => {
    expect(formatPkrRange(231700, 231700)).toBe("Rs 2,317");
    expect(formatPkrRange(231700, 273000)).toBe("Rs 2,317 – Rs 2,730");
  });
});

describe("parseRupeesToPaisa", () => {
  it("accepts what a person would actually type", () => {
    expect(parseRupeesToPaisa("2317")).toBe(231700);
    expect(parseRupeesToPaisa("Rs 2,317")).toBe(231700);
    expect(parseRupeesToPaisa("2317.50")).toBe(231750);
  });

  it("rejects nonsense", () => {
    expect(parseRupeesToPaisa("")).toBeNull();
    expect(parseRupeesToPaisa("abc")).toBeNull();
  });
});
