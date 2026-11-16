export const hotelPackageDiscountPercent = 25
export const discountedHotelPackagePrice = (price: number) => Math.round(price * (100 - hotelPackageDiscountPercent)) / 100
