const diwaliDiscountPercent = 30
export const featuredOfferHotelId = 'f85d09ef-0222-4bc5-8842-f59c647791c7'

export function diwaliReferencePrice(price: number) {
  return Math.round(price / (1 - diwaliDiscountPercent / 100) * 100) / 100
}