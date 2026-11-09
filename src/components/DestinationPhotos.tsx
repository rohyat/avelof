import type { destinations } from '../data/catalog'

export default function DestinationPhotos({ places }: { places: (typeof destinations)[number][] }) {
  const photos = places.map((place) => <div className="destination-photo-frame" key={place.id}>
    <img src={place.image} alt={place.photoCredit ? place.name : `${place.name}, illustrative landscape`} loading="lazy" />
    {place.photoCredit && <small className="destination-photo-credit"><a href={place.photoCredit.source} target="_blank" rel="noreferrer">{place.photoCredit.author}</a> · <a href={place.photoCredit.licenseUrl} target="_blank" rel="noreferrer">CC BY-SA 4.0</a></small>}
  </div>)
  return places.length > 1 ? <div className="destination-photo-pair">{photos}</div> : photos[0]
}