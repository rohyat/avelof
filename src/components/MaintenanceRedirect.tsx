import { Navigate, useLocation } from 'react-router-dom'

interface MaintenanceRedirectProps {
  maintenanceMode?: boolean
  children: React.ReactNode
}

export default function MaintenanceRedirect({ maintenanceMode, children }: MaintenanceRedirectProps) {
  const location = useLocation()
  
  // Block access to booking-related pages during maintenance
  const blockedPaths = ['/tour-packages', '/hotels', '/car-rentals', '/local-trips']
  const isBlockedPage = blockedPaths.some(path => location.pathname.startsWith(path))
  
  if (maintenanceMode && isBlockedPage) {
    return <Navigate to="/" replace />
  }
  
  return children as React.ReactElement
}
