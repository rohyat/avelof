import { ArrowRight, Camera } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ladakhPhotoPreview, ladakhPhotos } from '../data/ladakhPhotos'
import './ladakhPhotoGallery.css'

export default function LadakhPhotoGallery({ preview = false }: { preview?: boolean }) {
  const photos = preview ? ladakhPhotoPreview : ladakhPhotos
  return <section className="page-width ladakh-photo-collection" id={preview ? undefined : 'photo-inspiration'} aria-label={preview ? 'Ladakh photo highlights' : 'Shared photo inspiration'}>
    <p className="eyebrow"><Camera size={16} aria-hidden="true" />Journey inspiration</p>
    <h2>{preview ? 'A glimpse of the journey.' : 'Inspiration for your next journey.'}</h2>
    <p className="ladakh-photo-collection-intro">{preview ? 'Explore lakes, valley roads and monastery landscapes before choosing your route.' : 'Browse lakes, monastery landscapes and mountain scenes. Images labelled “Location unverified” are visual inspiration, not verified photographs of Ladakh or promises of what a trip includes.'}</p>
    <div className="ladakh-photo-collection-grid">{photos.map((photo) => <figure key={photo.src}>
      <div className="ladakh-photo-collection-image"><img src={photo.src} alt={photo.alt} width={768} height={1000} loading="lazy" decoding="async" />{photo.unverified && <span>Location unverified</span>}</div>
      <figcaption><strong>{photo.title}</strong><p>{photo.note}</p></figcaption>
    </figure>)}</div>
    {preview && <Link className="text-link" to="/ladakh/places#photo-inspiration">See all 11 shared photographs <ArrowRight size={16} aria-hidden="true" /></Link>}
  </section>
}
