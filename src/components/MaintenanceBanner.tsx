import { AlertCircle } from 'lucide-react'

export default function MaintenanceBanner() {
  return <div className="maintenance-banner" role="alert">
    <div className="maintenance-banner-content">
      <AlertCircle size={24} aria-hidden="true" />
      <div className="maintenance-banner-text">
        <strong>⚠️ Website Currently Under Maintenance - Booking Temporarily Disabled</strong>
        <p>We appreciate your patience. We're working on improvements and will be back soon!</p>
      </div>
    </div>
  </div>
}
