import { diwaliReferencePrice } from '../data/offers'
import DiscountLabel from './DiscountLabel'

export default function OfferPrice({ price }: { price: number }) {
  const originalPrice = diwaliReferencePrice(price)
  return <span className="original-price offer-price" title="Calculated pre-discount reference price for this offer; not a verified historical price.">
    <span>Before offer </span><s aria-label={`Pre-discount reference price ₹${originalPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}>₹{originalPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</s><DiscountLabel price={price} originalPrice={originalPrice} />
  </span>
}