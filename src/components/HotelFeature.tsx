import { Accessibility, Baby, BedDouble, BellRing, CarFront, Check, Coffee, Flame, Landmark, MapPin, Mountain, Snowflake, Trees, Utensils, Waves, Wifi, Zap, ArrowUpDown } from 'lucide-react'

export default function HotelFeature({ label }: { label: string }) {
  const Icon = /wi-?fi/i.test(label) ? Wifi
    : /parking/i.test(label) ? CarFront
    : /wheelchair|accessib/i.test(label) ? Accessibility
    : /lift|elevator/i.test(label) ? ArrowUpDown
    : /hot water|pool|lake|river/i.test(label) ? Waves
    : /backup|power/i.test(label) ? Zap
    : /air conditioning|ac room/i.test(label) ? Snowflake
    : /heating|heater/i.test(label) ? Flame
    : /breakfast|tea|coffee/i.test(label) ? Coffee
    : /restaurant|dining|meal/i.test(label) ? Utensils
    : /room service|reception/i.test(label) ? BellRing
    : /mountain|valley|view/i.test(label) ? Mountain
    : /garden|outdoor/i.test(label) ? Trees
    : /family|child/i.test(label) ? Baby
    : /market|location|near/i.test(label) ? MapPin
    : /attraction|heritage/i.test(label) ? Landmark
    : /room|bed|suite/i.test(label) ? BedDouble : Check
  return <span className="hotel-feature"><Icon size={18} aria-hidden="true" /><span>{label}</span></span>
}
