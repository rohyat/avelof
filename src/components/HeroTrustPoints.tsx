import { CircleCheck, CreditCard, Phone, ShieldCheck } from 'lucide-react'

export default function HeroTrustPoints() {
  return <div className="hero-trust">
    <ul className="hero-trust-points" aria-label="Our commitment to you" tabIndex={0} title="Hover or focus to pause messages">
      <li><CircleCheck size={21} aria-hidden="true" /><span>All-inclusive prices, with no hidden charges</span></li>
      <li><Phone size={21} aria-hidden="true" /><span>24/7 customer support, always with you</span></li>
      <li><ShieldCheck size={21} aria-hidden="true" /><span>Your safety and care, our priority</span></li>
      <li><CreditCard size={21} aria-hidden="true" /><span>Tour packages: 25% advance, 75% after the trip.</span></li>
    </ul>
  </div>
}
