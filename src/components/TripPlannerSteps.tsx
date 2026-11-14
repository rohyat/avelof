import { Check } from 'lucide-react'

export default function TripPlannerSteps({ step, onStepChange, disabled = false }: { step: number; onStepChange: (step: number) => void; disabled?: boolean }) {
  return <ol className="planner-steps" aria-label="Trip planning steps">
    {['Date', 'Places', 'Vehicle', 'Hotels', 'Contact details'].map((label, index) => <li key={label} className={index < step ? 'is-complete' : undefined} aria-current={step === index ? 'step' : undefined}>
      <button type="button" className="planner-step-button" aria-label={`Step ${index + 1}: ${label}${index < step ? ', completed. Edit' : ''}`} disabled={disabled || index >= step} onClick={() => onStepChange(index)}>
      <span className="planner-step-number">{index < step ? <Check size={16} aria-hidden="true" /> : index + 1}</span>
      <span className="planner-step-label">{label}</span>{index < step && <small className="sr-only"> completed</small>}
      </button>
    </li>)}
  </ol>
}
