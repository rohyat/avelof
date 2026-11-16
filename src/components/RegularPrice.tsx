import DiscountLabel from './DiscountLabel'

export default function RegularPrice({ price, originalPrice }: { price: number; originalPrice?: number }) {
  if (originalPrice === undefined || originalPrice <= price) return null
  return <span className="regular-price"><s aria-label="Regular price">₹{originalPrice.toLocaleString('en-IN')}</s><DiscountLabel price={price} originalPrice={originalPrice} /></span>
}
