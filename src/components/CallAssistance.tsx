import { ArrowUpRight, Phone } from 'lucide-react'
import { business } from '../config'
import HeroTrustPoints from './HeroTrustPoints'

export default function CallAssistance({ registration = false }: { registration?: boolean }) {
  return <div className="home-call-panel">
    <a className="home-call-tile" href={`tel:${business.phone.replace(/[^\d+]/g, '')}`}>
      <span className="home-call-icon"><Phone size={26} aria-hidden="true" /></span>
      <div className="home-call-copy">
        {!registration && <HeroTrustPoints />}
        <span>{registration ? 'Need help with registration? Give us a call. We’ll guide you through it.' : 'We’ll help you plan your trip based on your requirements.'}</span>
      </div>
      <span className="home-call-action"><span>Call AVELOF directly <ArrowUpRight size={18} aria-hidden="true" /></span><b>{business.phone}</b></span>
    </a>
  </div>
}
