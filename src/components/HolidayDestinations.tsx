import { Mountain, Sailboat, TentTree, Trees } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function HolidayDestinations({ destination }: { destination: 'kashmir' | 'ladakh' }) {
  return <nav className="home-destinations page-width" aria-label="Holiday destinations">
    <div className="home-destination-grid">
      <Link className="home-destination-card" to="/" aria-current={destination === 'kashmir' ? 'page' : undefined}><span className="home-destination-icon"><Sailboat size={26} aria-hidden="true" /></span><span className="home-destination-name">Kashmir</span></Link>
      <Link className="home-destination-card" to="/ladakh" aria-current={destination === 'ladakh' ? 'page' : undefined}><span className="home-destination-icon"><Mountain size={26} aria-hidden="true" /></span><span className="home-destination-name">Ladakh</span></Link>
      <button className="home-destination-card" type="button" disabled><span className="home-destination-icon"><Trees size={26} aria-hidden="true" /></span><span className="home-destination-name">Shimla</span><span className="home-destination-status">Coming soon</span></button>
      <button className="home-destination-card" type="button" disabled><span className="home-destination-icon"><TentTree size={26} aria-hidden="true" /></span><span className="home-destination-name">Manali</span><span className="home-destination-status">Coming soon</span></button>
      <button className="home-destination-card" type="button" disabled><span className="home-destination-icon"><svg className="spiti-monastery" width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21h18M4 21V11h6m4 0h6v10M8 21V7h8v14M7 7h10L12 3 7 7ZM3 11h5m8 0h5M11 21v-5h2v5M11 10h2M5 14h1m12 0h1M5 17h1m12 0h1" /></svg></span><span className="home-destination-name">Spiti Valley</span><span className="home-destination-status">Coming soon</span></button>
    </div>
  </nav>
}
