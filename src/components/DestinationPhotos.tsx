import type { destinations } from '../data/catalog'
import RotatingPhotos from './RotatingPhotos'

type Place = (typeof destinations)[number]

export default function DestinationPhotos({ places }: { places: Place[] }) {
  const photos = places.flatMap((place) => [
    { image: place.image, alt: place.photoCredit || place.photoIsUserProvided ? place.name : `${place.name}, illustrative landscape`, photoCredit: place.photoCredit },
    ...(place.additionalPhotos ?? []).map((photo) => ({ ...photo, photoCredit: undefined })),
  ])
  return <RotatingPhotos photos={photos} className="destination-photo-frame" label="Destination photos" />
}
