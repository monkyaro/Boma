import { describe, expect, it } from "vitest";
import { formatPrice, listingTypeLabel } from "./format";

describe("formatPrice", () => {
  it("formats TZS without decimals", () => {
    expect(formatPrice("350000000.00")).toBe("TSh\u00a0350,000,000");
  });

  it("returns a dash for invalid values", () => {
    expect(formatPrice("abc")).toBe("-");
  });
});

describe("listingTypeLabel", () => {
  it("labels rent and sale", () => {
    expect(listingTypeLabel("rent")).toBe("For rent");
    expect(listingTypeLabel("sale")).toBe("For sale");
  });
});
