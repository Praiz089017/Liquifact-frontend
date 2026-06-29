import { formatAmount, formatYield } from "@/lib/format/invoice";

describe("Invoice format helpers", () => {
  test("formatAmount produces locale‑aware string", () => {
    const value = 12500;
    const expected = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
    expect(formatAmount(value)).toBe(expected);
  });

  test("formatYield adds percent sign", () => {
    expect(formatYield(8.2)).toBe("8.2%");
    expect(formatYield(7)).toBe("7%");
  });

  test("numeric sorting works for invoice fixtures", () => {
    const invoices = [
      { id: "a", amountValue: 22000 },
      { id: "b", amountValue: 12500 },
      { id: "c", amountValue: 7800 },
    ];
    const sorted = [...invoices].sort((x, y) => x.amountValue - y.amountValue);
    expect(sorted.map((i) => i.id)).toEqual(["c", "b", "a"]);
  });

  describe("formatAmount boundary cases", () => {
    test("formats zero correctly", () => {
      const expected = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(0);
      expect(formatAmount(0)).toBe(expected);
    });

    test("formats large values with thousands separators", () => {
      const value = 1_000_000;
      const formatted = formatAmount(value);
      expect(formatted).toContain("1");
      expect(formatted.length).toBeGreaterThan(6);
    });

    test("formats negative values", () => {
      const formatted = formatAmount(-500);
      expect(formatted).toContain("500");
    });
  });

  describe("formatYield boundary cases", () => {
    test("handles zero yield", () => {
      expect(formatYield(0)).toBe("0%");
    });

    test("handles fractional yield", () => {
      expect(formatYield(3.14)).toBe("3.14%");
    });

    test("handles negative yield", () => {
      expect(formatYield(-2.5)).toBe("-2.5%");
    });
  });
});
