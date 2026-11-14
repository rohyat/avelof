import { Check } from 'lucide-react'

export default function TripPlannerSteps({ step }: { step: number }) {
  return <ol className="planner-steps" aria-label="Trip planning steps">
    {['Dates & places', 'Vehicle', 'Hotels', 'Your details'].map((label, index) => <li key={label} className={index < step ? 'is-complete' : undefined} aria-current={step === index ? 'step' : undefined}>
      <span>{index < step ? <Check size={16} aria-hidden="true" /> : index + 1}</span>{label}{index < step && <small className="sr-only"> completed</small>}
    </li>)}
  </ol>
}
