import { useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTourPackages } from '../services/pricingContext'
import RegularPrice from './RegularPrice'
import type { TourPackage } from '../types'
import type { ReactNode } from 'react'

const rows: { label: string; render: (item: TourPackage) => ReactNode }[] = [
  { label: 'Days & nights', render: (item) => item.duration },
  { label: 'Price per person', render: (item) => <><RegularPrice price={item.price} originalPrice={item.originalPrice} /><strong className="comparison-price">₹{item.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong><small>All taxes and charges included</small></> },
  { label: 'Places', render: (item) => item.location },
  { label: 'Hotel category', render: (item) => item.hotelStandard },
  { label: 'Overnight stays', render: (item) => <ul>{item.stays.map((stay) => <li key={`${stay.location}-${stay.hotel}`}><strong>{stay.location}: {stay.nights} {stay.nights === 1 ? 'night' : 'nights'}</strong><br />{stay.hotel}</li>)}</ul> },
  { label: 'Transport', render: (item) => item.transport },
  { label: 'Tour guide', render: (item) => item.tourGuide },
  { label: 'Inclusions', render: (item) => <ul>{item.inclusions.map((entry) => <li key={entry}>{entry}</li>)}</ul> },
  { label: 'Exclusions', render: (item) => <ul>{item.exclusions.map((entry) => <li key={entry}>{entry}</li>)}</ul> },
]

export default function PackageComparison({ className = '' }: { className?: string }) {
  const packages = useTourPackages().filter((item) => !item.underDevelopment)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const element = dialog.current
    const button = trigger.current
    const previousOverflow = document.body.style.overflow
    element?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = previousOverflow
      button?.focus()
    }
  }, [open])

  return <>
    <button ref={trigger} type="button" className={`button button-outline package-compare-button ${className}`} disabled={packages.length < 2} aria-haspopup="dialog" onClick={() => setOpen(true)}><ArrowLeftRight size={16} aria-hidden="true" />Compare</button>
    {open && <dialog ref={dialog} className="package-comparison" aria-label="Compare Kashmir packages" aria-describedby="package-comparison-description" onCancel={() => setOpen(false)} onClose={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setOpen(false) } }}>
      <header className="comparison-heading"><div><p className="eyebrow">Find your kind of journey</p><h2>Compare packages</h2></div><button type="button" className="icon-button" aria-label="Close package comparison" autoFocus onClick={() => setOpen(false)}><X size={22} /></button></header>
      <p id="package-comparison-description">Compare all three packages. Prices depend on travel dates and availability; your enquiry is not a confirmed booking.</p>
      <p className="privacy-note">Hotel categories describe the requested stay standard; individual properties and official classifications are confirmed separately.</p>
      <p className="comparison-tier-note">Premium includes all Deluxe services, with upgraded stays, heating and union cabs. Luxury includes all Premium services, plus Gondola tickets, a dedicated guide and a final luxury houseboat night. Trip lengths and hotel categories differ by package.</p>
      <p className="comparison-mobile-hint">Compare each feature below. Tap a heading to expand all three packages.</p>
      <div className="comparison-mobile">
        {rows.map((row, index) => <details className="comparison-feature" key={row.label} open={index < 2 || row.label === 'Hotel category'}>
          <summary>{row.label}</summary>
          <dl>{packages.map((item) => <div key={item.id}><dt>{item.name}</dt><dd>{row.render(item)}</dd></div>)}</dl>
        </details>)}
        <nav className="comparison-mobile-links" aria-label="Explore compared packages">{packages.map((item) => <Link className="button button-outline" key={item.id} to={`/tour-packages/${item.id}`} onClick={() => setOpen(false)}>View {item.name} itinerary</Link>)}</nav>
      </div>
      <div className="comparison-table-scroll" tabIndex={0} role="region" aria-label="Package comparison table">
        <table><caption className="sr-only">Days, hotel categories, stays, current prices, inclusions and exclusions</caption>
          <thead><tr><th scope="col">Compare</th>{packages.map((item) => <th scope="col" key={item.id}>{item.name}<Link to={`/tour-packages/${item.id}`} onClick={() => setOpen(false)}>View itinerary</Link></th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{packages.map((item) => <td key={item.id}>{row.render(item)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </dialog>}
  </>
}
