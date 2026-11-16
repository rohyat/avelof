export const hotelPackageDiscountPercent = 23
export const hotelPackagePriceInclusions = 'All taxes and charges included'
export const discountedHotelPackagePrice = (price: number, discountPercent = hotelPackageDiscountPercent) => Math.round(price * (10000 - Math.round(discountPercent * 100)) / 100) / 100
export const discountedHotelRoomPrice = (price: number, discountPercent = hotelPackageDiscountPercent) => Math.round(discountedHotelPackagePrice(price, discountPercent))
export const packagePriceForNights = (price: number, standardNights: number, selectedNights: number) => {
  if (!Number.isInteger(standardNights) || standardNights < 1 || !Number.isInteger(selectedNights) || selectedNights < 1) throw new RangeError('Package nights must be positive whole numbers.')
  return Math.round(price * selectedNights / standardNights * 100) / 100
}
