export const diwaliDiscountPercent = 30

export function diwaliReferencePrice(price: number) {
  return Math.round(price / (1 - diwaliDiscountPercent / 100) * 100) / 100
}