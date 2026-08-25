import { describe, expect, it } from "vitest";
import { customerPriceFromSellerPrice, PLATFORM_MARKUP_PERCENT } from "@/lib/workflow";

/**
 * These rules are enforced in the database (apply_product_pricing, place_order).
 * The tests lock the client-side mirror of the same maths so the two never drift.
 */
describe("platform product markup", () => {
  it("is 10 percent", () => {
    expect(PLATFORM_MARKUP_PERCENT).toBe(10);
  });

  it("charges the customer 1.1x what the seller receives", () => {
    expect(customerPriceFromSellerPrice(20000)).toBe(22000);
    expect(customerPriceFromSellerPrice(1000)).toBe(1100);
  });

  it("rounds to two decimals", () => {
    expect(customerPriceFromSellerPrice(9.99)).toBe(10.99);
  });
});

/** Delivery fees split 85% rider / 15% platform on the combined fee. */
function deliverySplit(totalFee: number, riderPercent = 85) {
  const rider = Math.round(totalFee * (riderPercent / 100) * 100) / 100;
  return { rider, platform: Math.round((totalFee - rider) * 100) / 100 };
}

describe("delivery fee split", () => {
  it("splits a base-only fee", () => {
    expect(deliverySplit(600)).toEqual({ rider: 510, platform: 90 });
  });

  it("splits base plus per-product delivery fees", () => {
    expect(deliverySplit(1100)).toEqual({ rider: 935, platform: 165 });
  });

  it("never loses or invents money", () => {
    for (const fee of [0, 1, 333, 749.5, 12345]) {
      const { rider, platform } = deliverySplit(fee);
      expect(Math.round((rider + platform) * 100) / 100).toBe(Math.round(fee * 100) / 100);
    }
  });
});
