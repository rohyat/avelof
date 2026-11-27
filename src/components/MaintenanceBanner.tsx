import { AlertCircle } from 'lucide-react'

export default function MaintenanceBanner() {
  return <div className="maintenance-banner" role="alert">
    <div className="maintenance-banner-content">
      <AlertCircle size={24} aria-hidden="true" />
      <span className="maintenance-banner-text">⚠️ Website Currently Under Maintenance - Booking Temporarily Disabled</span>
    </div>
  </div>
}
