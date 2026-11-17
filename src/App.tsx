import { Navigate, Route, Routes } from 'react-router-dom'
import SiteLayout from './components/SiteLayout'
import { AboutPage, CollectionPage, DetailPage, HomePage, NotFoundPage, ReviewsPage } from './pages/Pages'
import DestinationsPage from './pages/DestinationsPage'
import EnquiriesPage, { AdminEnquiriesPage } from './pages/EnquiriesPage'
import { AdminReviewsPage } from './pages/ReviewsPage'
import HotelRegistrationPage, { AdminHotelsPage, HotelStatusPage } from './pages/HotelRegistrationPage'
import PartnersPage from './pages/PartnersPage'
import DriverRegistrationPage, { AdminDriversPage, DriverStatusPage } from './pages/DriverRegistrationPage'
import DriversPage from './pages/DriversPage'
import DriverReviewsPage from './pages/DriverReviewsPage'
import { ActivitiesPage, FoodAndShoppingPage, TravelGuidePage } from './pages/DiscoveryPages'
import BusinessRegistrationPage, { AdminBusinessesPage, BusinessStatusPage } from './pages/BusinessRegistrationPage'
import LocalTripsPage from './pages/LocalTripsPage'
import PricingProvider from './components/PricingProvider'
import LadakhPage from './pages/LadakhPage'
import LadakhJourneyPage from './pages/LadakhJourneyPage'
import RegionalHotelsPage from './pages/RegionalHotelsPage'
import { ladakhPages } from './data/ladakh'

export default function App() {
  return (
    <PricingProvider><Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="ladakh" element={<LadakhPage />} />
        {Object.keys(ladakhPages).map((section) => <Route key={section} path={`ladakh/${section}`} element={<LadakhPage section={section as keyof typeof ladakhPages} />} />)}
        <Route path="ladakh/packages/:slug" element={<LadakhJourneyPage section="packages" />} />
        <Route path="ladakh/bike-trips/:slug" element={<LadakhJourneyPage section="bike-trips" />} />
        <Route path="ladakh/car-rentals/:slug" element={<LadakhJourneyPage section="car-rentals" />} />
        <Route path="ladakh/hotels" element={<RegionalHotelsPage region="Ladakh" />} />
        <Route path="ladakh/hotels/:hotelId/reviews" element={<DriverReviewsPage />} />
        <Route path="ladakh/hotels/:slug" element={<DetailPage />} />
        <Route path="ladakh/drivers" element={<DriversPage region="Ladakh" />} />
        <Route path="ladakh/drivers/:driverId/reviews" element={<DriverReviewsPage />} />
        <Route path="ladakh/partners" element={<PartnersPage region="Ladakh" />} />
        <Route path="jammu/hotels" element={<RegionalHotelsPage region="Jammu" />} />
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
    </Routes></PricingProvider>
  )
}
