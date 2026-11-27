import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import MaintenanceBanner from './components/MaintenanceBanner'
import SiteLayout from './components/SiteLayout'
import PricingProvider from './components/PricingProvider'
import { AboutPage, CollectionPage, DetailPage, HomePage, NotFoundPage, ReviewsPage } from './pages/Pages'

// Lazy load non-critical pages for faster initial load
const DestinationsPage = lazy(() => import('./pages/DestinationsPage'))
const EnquiriesPage = lazy(() => import('./pages/EnquiriesPage').then(m => ({ default: m.default })))
const AdminEnquiriesPage = lazy(() => import('./pages/EnquiriesPage').then(m => ({ default: m.AdminEnquiriesPage })))
const AdminReviewsPage = lazy(() => import('./pages/ReviewsPage').then(m => ({ default: m.AdminReviewsPage })))
const HotelRegistrationPage = lazy(() => import('./pages/HotelRegistrationPage').then(m => ({ default: m.default })))
const AdminHotelsPage = lazy(() => import('./pages/HotelRegistrationPage').then(m => ({ default: m.AdminHotelsPage })))
const HotelStatusPage = lazy(() => import('./pages/HotelRegistrationPage').then(m => ({ default: m.HotelStatusPage })))
const PartnersPage = lazy(() => import('./pages/PartnersPage'))
const DriverRegistrationPage = lazy(() => import('./pages/DriverRegistrationPage').then(m => ({ default: m.default })))
const AdminDriversPage = lazy(() => import('./pages/DriverRegistrationPage').then(m => ({ default: m.AdminDriversPage })))
const DriverStatusPage = lazy(() => import('./pages/DriverRegistrationPage').then(m => ({ default: m.DriverStatusPage })))
const DriversPage = lazy(() => import('./pages/DriversPage'))
const DriverReviewsPage = lazy(() => import('./pages/DriverReviewsPage'))
const ActivitiesPage = lazy(() => import('./pages/DiscoveryPages').then(m => ({ default: m.ActivitiesPage })))
const FoodAndShoppingPage = lazy(() => import('./pages/DiscoveryPages').then(m => ({ default: m.FoodAndShoppingPage })))
const TravelGuidePage = lazy(() => import('./pages/DiscoveryPages').then(m => ({ default: m.TravelGuidePage })))
const BusinessRegistrationPage = lazy(() => import('./pages/BusinessRegistrationPage').then(m => ({ default: m.default })))
const AdminBusinessesPage = lazy(() => import('./pages/BusinessRegistrationPage').then(m => ({ default: m.AdminBusinessesPage })))
const BusinessStatusPage = lazy(() => import('./pages/BusinessRegistrationPage').then(m => ({ default: m.BusinessStatusPage })))
const LocalTripsPage = lazy(() => import('./pages/LocalTripsPage'))
const LadakhPage = lazy(() => import('./pages/LadakhPage'))
const LadakhJourneyPage = lazy(() => import('./pages/LadakhJourneyPage'))
const RegionalHotelsPage = lazy(() => import('./pages/RegionalHotelsPage'))
const HotelComparisonPage = lazy(() => import('./pages/HotelComparisonPage'))
const ItineraryBuilderPage = lazy(() => import('./pages/ItineraryBuilderPage'))
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'))

import { ladakhPages } from './data/ladakh'

const LoadingFallback = () => <div />  // Silent loading - no UI bloat

export default function App() {
  const maintenanceMode = true // Set to false to remove banner
  
  return (
    <PricingProvider>
      {maintenanceMode && <MaintenanceBanner />}
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route element={<SiteLayout maintenanceMode={maintenanceMode} />}>
            <Route index element={<HomePage />} />
            <Route path="ladakh" element={<LadakhPage />} />
            {Object.keys(ladakhPages).map((section) => <Route key={section} path={`ladakh/${section}`} element={<LadakhPage section={section as keyof typeof ladakhPages} />} />)}
            <Route path="ladakh/packages/:slug" element={<LadakhJourneyPage section="packages" />} />
            <Route path="ladakh/bike-trips/:slug" element={<LadakhJourneyPage section="bike-trips" />} />
            <Route path="ladakh/car-rentals/:slug" element={<LadakhJourneyPage section="car-rentals" />} />
            <Route path="ladakh/hotels" element={<RegionalHotelsPage region="Ladakh" />} />
            <Route path="ladakh/hotels/compare" element={<HotelComparisonPage />} />
            <Route path="ladakh/hotels/:hotelId/reviews" element={<DriverReviewsPage />} />
            <Route path="ladakh/hotels/:slug" element={<DetailPage />} />
            <Route path="ladakh/drivers" element={<DriversPage region="Ladakh" />} />
            <Route path="ladakh/drivers/:driverId/reviews" element={<DriverReviewsPage />} />
            <Route path="ladakh/partners" element={<PartnersPage region="Ladakh" />} />
            <Route path="jammu/hotels" element={<RegionalHotelsPage region="Jammu" />} />
            <Route path="jammu/hotels/compare" element={<HotelComparisonPage />} />
            <Route path="jammu/hotels/:hotelId/reviews" element={<DriverReviewsPage />} />
            <Route path="jammu/hotels/:slug" element={<DetailPage />} />
            <Route path="jammu/drivers" element={<DriversPage region="Jammu" />} />
            <Route path="jammu/drivers/:driverId/reviews" element={<DriverReviewsPage />} />
            <Route path="tour-packages" element={<CollectionPage />} />
            <Route path="tour-packages/:slug" element={<DetailPage />} />
            <Route path="car-rentals" element={<CollectionPage />} />
            <Route path="car-rentals/:slug" element={<DetailPage />} />
            <Route path="drivers" element={<DriversPage />} />
            <Route path="drivers/:driverId/reviews" element={<DriverReviewsPage />} />
            <Route path="hotels" element={<CollectionPage />} />
            <Route path="hotels/compare" element={<HotelComparisonPage />} />
            <Route path="hotels/:hotelId/reviews" element={<DriverReviewsPage />} />
            <Route path="hotels/:slug" element={<DetailPage />} />
            <Route path="register-hotel" element={<HotelRegistrationPage />} />
            <Route path="hotel-status" element={<HotelStatusPage />} />
            <Route path="partners" element={<PartnersPage />} />
            <Route path="register-business" element={<BusinessRegistrationPage />} />
            <Route path="business-status" element={<BusinessStatusPage />} />
            <Route path="register-driver" element={<DriverRegistrationPage />} />
            <Route path="driver-status" element={<DriverStatusPage />} />
            <Route path="destinations" element={<DestinationsPage />} />
            <Route path="activities" element={<ActivitiesPage />} />
            <Route path="local-trips" element={<LocalTripsPage />} />
            <Route path="food-and-shopping" element={<FoodAndShoppingPage />} />
            <Route path="travel-guide" element={<TravelGuidePage />} />
            <Route path="my-enquiries" element={<EnquiriesPage />} />
            <Route path="admin/panel" element={<AdminEnquiriesPage />} />
            <Route path="admin/panel/itineraries" element={<ItineraryBuilderPage />} />
            <Route path="admin/panel/payments" element={<PaymentsPage />} />
            <Route path="admin/panel/reviews" element={<AdminReviewsPage />} />
            <Route path="admin/panel/hotels" element={<AdminHotelsPage />} />
            <Route path="admin/panel/drivers" element={<AdminDriversPage />} />
            <Route path="admin/panel/businesses" element={<AdminBusinessesPage />} />
            <Route path="my-enquiries/admin" element={<Navigate to="/admin/panel" replace />} />
            <Route path="my-enquiries/admin/reviews" element={<Navigate to="/admin/panel/reviews" replace />} />
            <Route path="reviews" element={<ReviewsPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<Navigate to="/about#contact" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </PricingProvider>
  )
}
