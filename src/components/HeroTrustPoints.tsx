import { CircleCheck, CreditCard, Phone, ShieldCheck } from 'lucide-react'
import { brandPromises } from '../data/brandPromises'

export default function HeroTrustPoints() {
  return <div className="hero-trust">
    <ul className="hero-trust-points" aria-label="Our commitment to you">
      <li><CircleCheck size={21} aria-hidden="true" /><span>{brandPromises[0]}</span></li>
      <li><Phone size={21} aria-hidden="true" /><span>{brandPromises[1]}</span></li>
      <li><ShieldCheck size={21} aria-hidden="true" /><span>{brandPromises[2]}</span></li>
      <li><CreditCard size={21} aria-hidden="true" /><span>{brandPromises[3]}</span></li>
    </ul>
  </div>
}
