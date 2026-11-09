export default function DiscountLabel({ price, originalPrice }: { price: number; originalPrice?: number }) {
  if (originalPrice === undefined || !Number.isFinite(originalPrice) || !Number.isFinite(price) || originalPrice <= 0 || price < 0 || price >= originalPrice) return null

  const percentage = Number(((originalPrice - price) / originalPrice * 100).toFixed(2))
  return <span className="discount-label">{percentage}% off</span>
}