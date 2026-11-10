import { Navigate, Route, Routes } from 'react-router-dom'
import SiteLayout from './components/SiteLayout'
import { AboutPage, CollectionPage, DetailPage, HomePage, NotFoundPage, ReviewsPage } from './pages/Pages'
import DestinationsPage from './pages/DestinationsPage'
import EnquiriesPage, { AdminEnquiriesPage } from './pages/EnquiriesPage'
import { AdminReviewsPage } from './pages/ReviewsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="tour-packages" element={<CollectionPage />} />
        <Route path="tour-packages/:slug" element={<DetailPage />} />
        <Route path="car-rentals" element={<CollectionPage />} />
        <Route path="car-rentals/:slug" element={<DetailPage />} />
        <Route path="hotels" element={<CollectionPage />} />
        <Route path="hotels/:slug" element={<DetailPage />} />
        <Route path="destinations" element={<DestinationsPage />} />
        <Route path="my-enquiries" element={<EnquiriesPage />} />
        <Route path="admin/panel" element={<AdminEnquiriesPage />} />
        <Route path="admin/panel/reviews" element={<AdminReviewsPage />} />
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
