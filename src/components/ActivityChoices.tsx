import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { activitiesForPlaces, activityDestinations } from '../data/activities'
import ActivityIcon from './ActivityIcon'

export default function ActivityChoices({ placeIds, selectedIds, onChange, sectionId, onViewDetails }: { placeIds: string[]; selectedIds: string[]; onChange: (ids: string[]) => void; sectionId: string; onViewDetails: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  const available = activitiesForPlaces(placeIds)
  return <section className="planner-activities" aria-labelledby="planner-activities-title">
    <h3 id="planner-activities-title">Choose your activities <span className="optional">Optional</span></h3>
    <p>Skipping paid activities does not remove sightseeing. Activities are requests only; availability and extra charges are confirmed separately.</p>
    <p role="status">{available.filter((activity) => selectedIds.includes(activity.id)).length} activities requested</p>
    {available.length ? activityDestinations.map((destination) => {
      const options = available.filter((activity) => activity.destination === destination)
      return options.length > 0 && <fieldset key={destination}><legend>{destination} activities</legend><div className="activity-choice-grid">{options.map((activity) => <div className="planner-activity-option" key={activity.id}><label className="activity-choice">
        <input type="checkbox" checked={selectedIds.includes(activity.id)} onChange={(event) => onChange(event.target.checked ? [...selectedIds, activity.id] : selectedIds.filter((id) => id !== activity.id))} />
        <span><strong className="activity-choice-heading"><ActivityIcon activity={activity} /><span>{activity.name}</span></strong></span>
      </label><Link className="text-link" to={`/activities?activity=${encodeURIComponent(activity.id)}`} state={{ tripReturn: { sectionId, returnPath: sectionId === 'package-planner' ? '/tour-packages' : '/' } }} onClick={onViewDetails} aria-label={`View details: ${activity.name}`}>View activity details <ArrowRight size={13} aria-hidden="true" /></Link></div>)}</div></fieldset>
    }) : <p>No activity choices are listed for these places yet. You can continue without activities.</p>}
  </section>
}
