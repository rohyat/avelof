import { Bike, CableCar, Fish, Footprints, MountainSnow, Sailboat, Ship, ShoppingBasket, Snowflake, Waves, Waypoints } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Activity, ActivityCategory } from '../data/activities'

const experienceIcons: Record<string, LucideIcon> = {
  'srinagar-shikara': Sailboat,
  'srinagar-floating-market': ShoppingBasket,
  'srinagar-boat-ride': Ship,
  'gulmarg-gondola': CableCar,
  'gulmarg-skiing': MountainSnow,
  'gulmarg-snowboarding': MountainSnow,
  'gulmarg-snowmobile': Snowflake,
  'gulmarg-pony': Footprints,
  'gulmarg-atv': Bike,
  'sonamarg-pony': Footprints,
  'sonamarg-sledging': Snowflake,
  'sonamarg-rafting': Waves,
  'sonamarg-trek': Footprints,
  'sonamarg-atv': Bike,
  'pahalgam-pony': Footprints,
  'pahalgam-rafting': Waves,
  'pahalgam-angling': Fish,
  'pahalgam-trek': Footprints,
  'pahalgam-zipline': Waypoints,
}

const categoryIcons: Record<ActivityCategory, LucideIcon> = {
  Water: Waves, Snow: Snowflake, Adventure: Waypoints, Nature: Footprints, Culture: ShoppingBasket,
}

export default function ActivityIcon({ activity }: { activity: Activity }) {
  const Icon = experienceIcons[activity.id] ?? categoryIcons[activity.category]
  return <Icon className="activity-icon" size={24} aria-hidden="true" />
}
