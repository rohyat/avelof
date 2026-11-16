import DiscountLabel from './DiscountLabel'

export default function RegularPrice({ price, originalPrice, discountPercent }: { price: number; originalPrice?: number; discountPercent?: number }) {
  if (originalPrice === undefined || originalPrice <= price) return null
  return <span className="regular-price"><s aria-label="Regular price">₹{originalPrice.toLocaleString('en-IN')}</s>{discountPercent === undefined ? <DiscountLabel price={price} originalPrice={originalPrice} /> : <span className="discount-label">{discountPercent}% off</span>}</span>
}
