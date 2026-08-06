import { describe, expect, it } from "vitest";
import { computeLineAmount, computeTotals } from "./totals";

describe("computeLineAmount", () => {
  it("multiplies quantity by rate", () => {
    expect(computeLineAmount(2, 50)).toBe(100);
  });

  it("handles fractional quantities (e.g. hourly labor)", () => {
    expect(computeLineAmount(1.5, 60)).toBe(90);
  });

  it("is zero when quantity is zero", () => {
    expect(computeLineAmount(0, 850)).toBe(0);
  });
});

describe("computeTotals", () => {
  it("returns zero for no lines", () => {
    expect(computeTotals([])).toEqual({ subtotal: 0, total: 0 });
  });

  it("sums a single line", () => {
    expect(computeTotals([{ quantity: 2, rate: 175 }])).toEqual({ subtotal: 350, total: 350 });
  });

  it("sums multiple lines", () => {
    const lines = [
      { quantity: 1, rate: 850 }, // tree removal
      { quantity: 1, rate: 175 }, // stump grinding
      { quantity: 2, rate: 120 }, // two loads of debris haul-away
    ];
    expect(computeTotals(lines)).toEqual({ subtotal: 1265, total: 1265 });
  });

  it("total always equals subtotal — no tax handling in v1", () => {
    const { subtotal, total } = computeTotals([{ quantity: 3, rate: 33.33 }]);
    expect(total).toBe(subtotal);
  });
});
