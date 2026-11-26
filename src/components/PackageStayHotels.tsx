import { Link } from 'react-router-dom'
import { Building2, ChevronRight, Sailboat } from 'lucide-react'
import type { Hotel, TourPackage } from '../types'
import { hotelsForPackageStay } from '../services/packageHotels'

export default function PackageStayHotels({ item, stay, hotels, onNavigate }: {
  item: TourPackage
  stay: TourPackage['stays'][number]
  hotels: readonly Hotel[]
  onNavigate?: () => void
}) {
  const options = hotelsForPackageStay(hotels, item.id, stay)
  if (!options.length) return <p>{stay.hotel}</p>
  return <div className="package-stay-options">
    <p className="package-stay-options-label">Possible stays</p>
    <ul>{options.map((hotel) => {
      const Icon = hotel.propertyType === 'Houseboat' ? Sailboat : Building2
      return <li key={hotel.id}><Link to={`/hotels/${hotel.id}`} onClick={onNavigate}>
        <Icon className="package-stay-option-icon" size={16} aria-hidden="true" />
        <span className="package-stay-option-text"><span className="package-stay-option-name">{hotel.name}</span><span className="package-stay-option-category">{hotel.category}</span></span>
        <ChevronRight className="package-stay-option-arrow" size={16} aria-hidden="true" />
      </Link></li>
    })}</ul>
    <p className="package-stay-options-note">Subject to availability and confirmation.</p>
  </div>
}
