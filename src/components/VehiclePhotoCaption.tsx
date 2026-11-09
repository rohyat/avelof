import type { RentalCar } from '../types'

export default function VehiclePhotoCaption({ vehicle }: { vehicle: RentalCar }) {
  return <div className="vehicle-photo-caption" aria-label={`${vehicle.name} branding`}>
    <strong>AVELOF</strong>
    <span>Journey Beyond Imagination</span>
  </div>
}