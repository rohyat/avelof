import { Accessibility, Baby, Bath, BedDouble, BellRing, CarFront, Check, Coffee, Droplets, Flame, Landmark, MapPin, Mountain, ShowerHead, Snowflake, Trees, Utensils, Waves, Wifi, Wind, Zap, ArrowUpDown, Dumbbell, Waves as Waves2, Sparkles } from 'lucide-react'

export default function HotelFeature({ label }: { label: string }) {
  const Icon = /wi-?fi/i.test(label) ? Wifi
    : /parking/i.test(label) ? CarFront
    : /wheelchair|accessib/i.test(label) ? Accessibility
    : /lift|elevator/i.test(label) ? ArrowUpDown
    : /bathroom|bathtub/i.test(label) ? Bath
    : /shower/i.test(label) ? ShowerHead
    : /towel|toiletr/i.test(label) ? Droplets
    : /hair dryer/i.test(label) ? Wind
    : /hot water|pool|lake|river/i.test(label) ? Waves
    : /backup|power/i.test(label) ? Zap
    : /air conditioning|ac room|hot & cold ac/i.test(label) ? Snowflake
    : /heating|heater/i.test(label) ? Flame
    : /breakfast|tea|coffee|kettle|cafe/i.test(label) ? Coffee
    : /restaurant|dining|meal/i.test(label) ? Utensils
    : /room service|reception/i.test(label) ? BellRing
    : /mountain|valley|view/i.test(label) ? Mountain
    : /garden|outdoor/i.test(label) ? Trees
    : /family|child/i.test(label) ? Baby
    : /market|location|near/i.test(label) ? MapPin
    : /attraction|heritage/i.test(label) ? Landmark
    : /gym/i.test(label) ? Dumbbell
    : /swimming pool/i.test(label) ? Waves2
    : /jacuzzi/i.test(label) ? Sparkles
    : /room|bed|suite/i.test(label) ? BedDouble : Check
  return <span className="hotel-feature"><Icon size={18} aria-hidden="true" /><span>{label}</span></span>
}
