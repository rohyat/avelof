const destinationImagePath = '/images/destinations/'

export const kashmirPhotoGallery = {
  roomOne: {
    image: `${destinationImagePath}kashmir-room-inspiration-01.jpg`,
    alt: 'Illustrative Kashmir bedroom interior',
    caption: 'Illustrative bedroom inspiration',
  },
  roomTwo: {
    image: `${destinationImagePath}kashmir-room-inspiration-02.jpg`,
    alt: 'Illustrative Kashmir guest-room interior',
    caption: 'Illustrative guest-room inspiration',
  },
  houseboat: {
    image: `${destinationImagePath}kashmir-houseboat-sunset.jpg`,
    alt: 'Houseboat on a Kashmir lake at sunset',
    caption: 'Houseboat at sunset',
  },
  valleyRiver: {
    image: `${destinationImagePath}kashmir-valley-river.jpg`,
    alt: 'River winding through a green Kashmir valley',
    caption: 'Green valley and river',
  },
  meadow: {
    image: `${destinationImagePath}kashmir-meadow-in-bloom.jpg`,
    alt: 'Flowering meadow beneath Kashmir mountain peaks',
    caption: 'Mountain meadow in bloom',
  },
  autumnGarden: {
    image: `${destinationImagePath}kashmir-autumn-garden.jpg`,
    alt: 'Autumn trees along a garden path in Kashmir',
    caption: 'Autumn colours in Kashmir',
  },
  waterfall: {
    image: `${destinationImagePath}kashmir-waterfall-gorge.jpg`,
    alt: 'Waterfall cascading through a wooded Kashmir gorge',
    caption: 'Waterfall through a wooded gorge',
  },
  snowyVillage: {
    image: `${destinationImagePath}kashmir-snowy-village.jpg`,
    alt: 'Snow-covered Kashmir village below mountain peaks',
    caption: 'A snow-covered Kashmir village',
  },
  snowLodge: {
    image: `${destinationImagePath}kashmir-snow-lodge.jpg`,
    alt: 'Snowy mountain lodge at dusk',
    caption: 'Snowy mountain stay inspiration',
  },
  snowyPeaks: {
    image: `${destinationImagePath}kashmir-snowy-peaks.jpg`,
    alt: 'Snow-covered Kashmir peaks above a forested meadow',
    caption: 'Snow-covered mountain peaks',
  },
} as const

export const kashmirPhotosForPdf = [
  kashmirPhotoGallery.houseboat,
  kashmirPhotoGallery.valleyRiver,
  kashmirPhotoGallery.meadow,
  kashmirPhotoGallery.autumnGarden,
  kashmirPhotoGallery.waterfall,
  kashmirPhotoGallery.snowyVillage,
  kashmirPhotoGallery.snowLodge,
  kashmirPhotoGallery.snowyPeaks,
  kashmirPhotoGallery.roomOne,
  kashmirPhotoGallery.roomTwo,
]
