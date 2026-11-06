import { Route, Routes } from 'react-router-dom'
import SiteLayout from './components/SiteLayout'
import { AboutPage, CollectionPage, ContactPage, DetailPage, HomePage, NotFoundPage, ReviewsPage } from './pages/Pages'
import DestinationsPage from './pages/DestinationsPage'

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
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
