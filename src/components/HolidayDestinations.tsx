import { Mountain, Sailboat } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function HolidayDestinations({ destination }: { destination: 'kashmir' | 'ladakh' }) {
  return <nav className="home-destinations page-width" aria-label="Holiday destinations">
    <div className="home-destination-grid">
      <Link className="home-destination-card" to="/" aria-current={destination === 'kashmir' ? 'page' : undefined}><span className="home-destination-icon"><Sailboat size={26} aria-hidden="true" /></span><span className="home-destination-name">Kashmir</span></Link>
      <Link className="home-destination-card" to="/ladakh" aria-current={destination === 'ladakh' ? 'page' : undefined}><span className="home-destination-icon"><Mountain size={26} aria-hidden="true" /></span><span className="home-destination-name">Ladakh</span></Link>
    </div>
  </nav>
}
