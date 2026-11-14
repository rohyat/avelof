import { activitiesForPlaces, activityAvailabilityNote, activityDestinations } from '../data/activities'
import ActivityIcon from './ActivityIcon'

export default function ActivityChoices({ placeIds, selectedIds, onChange }: { placeIds: string[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const available = activitiesForPlaces(placeIds)
  return <section className="planner-activities" aria-labelledby="planner-activities-title">
    <h3 id="planner-activities-title">Choose your activities <span className="optional">Optional</span></h3>
    <p>Adding activities is optional. Skipping paid activities does not remove sightseeing for your selected places from your plan. You can ask AVELOF to add activities later, subject to availability, local access and separate charges.</p>
    <p className="privacy-note">{activityAvailabilityNote}</p>
    <p role="status">{available.filter((activity) => selectedIds.includes(activity.id)).length} activities requested</p>
    {available.length ? activityDestinations.map((destination) => {
      const options = available.filter((activity) => activity.destination === destination)
      return options.length > 0 && <fieldset key={destination}><legend>{destination} activities</legend><div className="activity-choice-grid">{options.map((activity) => <label className="activity-choice" key={activity.id}>
        <input type="checkbox" checked={selectedIds.includes(activity.id)} onChange={(event) => onChange(event.target.checked ? [...selectedIds, activity.id] : selectedIds.filter((id) => id !== activity.id))} />
        <span><strong className="activity-choice-heading"><ActivityIcon activity={activity} /><span>{activity.name}</span></strong><small>{activity.season}</small><small>{activity.note}</small>{activity.operatorCheck && <small className="activity-check-note">Operator verification required</small>}</span>
      </label>)}</div></fieldset>
    }) : <p>No activity choices are listed for these places yet. You can continue without activities.</p>}
  </section>
}
