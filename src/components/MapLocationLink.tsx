import { MapPin } from 'lucide-react'
import { googleMapsLocationUrl, mapCoordinates } from '../services/mapLocation'

export default function MapLocationLink({ location }: { location: { latitude?: number | null; longitude?: number | null } }) {
  const coordinates = mapCoordinates(location)
  return coordinates && <a className="text-link map-location-link" href={googleMapsLocationUrl(coordinates)} target="_blank" rel="noopener noreferrer"><MapPin size={16} aria-hidden="true" /> View on Google Maps</a>
}
