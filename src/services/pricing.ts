export const hotelPackageDiscountPercent = 23
export const hotelPackagePriceInclusions = 'All taxes and charges included'
export const discountedHotelPackagePrice = (price: number, discountPercent = hotelPackageDiscountPercent) => Math.round(price * (10000 - Math.round(discountPercent * 100)) / 100) / 100
export const discountedHotelRoomPrice = (price: number, discountPercent = hotelPackageDiscountPercent) => Math.round(discountedHotelPackagePrice(price, discountPercent))
export const packageSeasonStart = '2026-12-06'
export const packageSeasonNotice = 'Package arrivals from 6 December 2026 are 10% higher. Arrivals through 5 December keep current rates.'
export const packagePriceForNights = (price: number, standardNights: number, selectedNights: number, arrivalDate?: string) => {
  if (!Number.isInteger(standardNights) || standardNights < 1 || !Number.isInteger(selectedNights) || selectedNights < 1) throw new RangeError('Package nights must be positive whole numbers.')
  if (arrivalDate) {
    const timestamp = Date.parse(`${arrivalDate}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(arrivalDate) || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== arrivalDate) throw new RangeError('Choose a valid package arrival date.')
  }
  const seasonalMultiplier = arrivalDate && arrivalDate >= packageSeasonStart ? 1.1 : 1
  return Math.round(price * selectedNights / standardNights * seasonalMultiplier * 100) / 100
}
