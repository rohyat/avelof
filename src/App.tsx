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

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
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
        <Route path="register-driver" element={<DriverRegistrationPage />} />
        <Route path="driver-status" element={<DriverStatusPage />} />
        <Route path="destinations" element={<DestinationsPage />} />
        <Route path="my-enquiries" element={<EnquiriesPage />} />
        <Route path="admin/panel" element={<AdminEnquiriesPage />} />
        <Route path="admin/panel/reviews" element={<AdminReviewsPage />} />
        <Route path="admin/panel/hotels" element={<AdminHotelsPage />} />
        <Route path="admin/panel/drivers" element={<AdminDriversPage />} />
        <Route path="my-enquiries/admin" element={<Navigate to="/admin/panel" replace />} />
        <Route path="my-enquiries/admin/reviews" element={<Navigate to="/admin/panel/reviews" replace />} />
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<Navigate to="/about#contact" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
