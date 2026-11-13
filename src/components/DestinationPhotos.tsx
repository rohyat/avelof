import { useEffect, useState } from 'react'
import type { destinations } from '../data/catalog'

type Place = (typeof destinations)[number]

export default function DestinationPhotos({ places }: { places: Place[] }) {
  const photos = places.flatMap((place) => [
    { image: place.image, alt: place.photoCredit || place.photoIsUserProvided ? place.name : `${place.name}, illustrative landscape`, photoCredit: place.photoCredit },
    ...(place.additionalPhotos ?? []).map((photo) => ({ ...photo, photoCredit: undefined })),
  ])
  const [activeIndex, setActiveIndex] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(preference.matches)
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (reducedMotion || photos.length < 2) return
    const timer = window.setInterval(() => setActiveIndex((index) => (index + 1) % photos.length), 1500)
    return () => window.clearInterval(timer)
  }, [photos.length, reducedMotion])

  const photo = photos[activeIndex]
  return <div className="destination-photo-frame" role={photos.length > 1 ? 'region' : undefined}
    aria-label={photos.length > 1 ? 'Destination photos' : undefined}
    aria-roledescription={photos.length > 1 ? 'carousel' : undefined}
    data-photo-count={photos.length}>
    <img src={photo.image} alt={photo.alt} loading="lazy" />
    {photo.photoCredit && <small className="destination-photo-credit"><a href={photo.photoCredit.source} target="_blank" rel="noreferrer">{photo.photoCredit.author}</a> · <a href={photo.photoCredit.licenseUrl} target="_blank" rel="noreferrer">CC BY-SA 4.0</a></small>}
  </div>
}
