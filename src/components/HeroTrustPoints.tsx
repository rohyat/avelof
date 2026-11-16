import { useState } from 'react'
import { CircleCheck, Pause, Phone, Play, ShieldCheck } from 'lucide-react'

export default function HeroTrustPoints() {
  const [paused, setPaused] = useState(false)
  return <div className={`hero-trust${paused ? ' is-paused' : ''}`}>
    <ul className="hero-trust-points" aria-label="Our commitment to you">
      <li><CircleCheck size={21} aria-hidden="true" /><span>All-inclusive prices, with no hidden charges</span></li>
      <li><Phone size={21} aria-hidden="true" /><span>24/7 customer support, always with you</span></li>
      <li><ShieldCheck size={21} aria-hidden="true" /><span>Your safety and care, our priority</span></li>
    </ul>
    <button className="hero-trust-toggle" type="button" aria-label={paused ? 'Resume rotating messages' : 'Pause rotating messages'} onClick={() => setPaused(!paused)}>{paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}</button>
  </div>
}
