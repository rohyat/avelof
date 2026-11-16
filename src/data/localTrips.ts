import { destinations } from './catalog.ts'
import { providedDestinationPhotos } from './previewPhotos.ts'
import { kashmirPhotoGallery } from './kashmirPhotoGallery.ts'

export const localTripPreferences = ['Local trek', 'Local picnic / day trip'] as const

export const localTreks = [
  { id: 'great-lakes', name: 'Kashmir Great Lakes', region: 'Sonamarg', description: 'A multi-day alpine-lake trek from the Sonamarg area; the exact route and lakes vary by itinerary.', highlights: ['Alpine lakes and mountain scenery', 'A multi-day, high-altitude trek', 'Route and overnight plans depend on the itinerary'], source: 'https://ganderbal.nic.in/tourist-place/sonamarg/' },
  { id: 'tarsar-marsar', name: 'Tarsar Marsar', region: 'Aru, Pahalgam', description: 'A multi-day trek through the Aru area towards the Tarsar and Marsar alpine lakes.', highlights: ['Begins in the Aru area', 'Mountain trails towards the Tarsar and Marsar lakes', 'A multi-day trek requiring a planned itinerary'], source: 'https://indiahikes.com/tarsar-marsar' },
  { id: 'kolahoi', name: 'Kolahoi Glacier', region: 'Aru, Pahalgam', description: 'A multi-day trek through the Lidder valley towards the Kolahoi Glacier area.', highlights: ['Explore the Lidder valley from the Aru area', 'Mountain scenery towards Kolahoi Glacier', 'A multi-day trek; access and route conditions need checking'], source: 'https://indiahikes.com/documented-trek/kolahoi-glacier-trek' },
  { id: 'kungwattan', name: 'Kungwattan meadow', region: 'Aharbal, Kulgam', description: 'A guided trekking excursion from the Aharbal area towards Kungwattan meadow.', highlights: ['A trek from the Aharbal area', 'Explore the Kungwattan meadow area', 'Check the route and arrangements with a guide'], source: 'https://kulgam.nic.in/tourist-place/aharbal/' },
] as const

export const picnicPlaces = destinations.filter((destination) =>
  ['srinagar', 'gulmarg', 'pahalgam', 'sonamarg', 'doodhpathri', 'yusmarg', 'aharbal', 'manasbal'].includes(destination.id))

export const localTrekPhotos: Record<(typeof localTreks)[number]['id'], { image: string; alt: string }> = {
  'great-lakes': { image: providedDestinationPhotos.greatLakesTrek, alt: kashmirPhotoGallery.snowyPeaks.alt },
  'tarsar-marsar': { image: providedDestinationPhotos.pahalgam, alt: kashmirPhotoGallery.valleyRiver.alt },
  kolahoi: { image: providedDestinationPhotos.pahalgam, alt: kashmirPhotoGallery.valleyRiver.alt },
  kungwattan: { image: kashmirPhotoGallery.waterfall.image, alt: kashmirPhotoGallery.waterfall.alt },
}
