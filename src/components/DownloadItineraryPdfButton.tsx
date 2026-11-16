import { useState } from 'react'
import { Download } from 'lucide-react'
import type { ItineraryPdfData } from '../services/itineraryPdf'
import { downloadBrandedItineraryPdf } from '../services/itineraryPdf'

export default function DownloadItineraryPdfButton({ data, label = 'Download itinerary PDF', className = 'button button-outline' }: { data: ItineraryPdfData; label?: string; className?: string }) {
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)

  async function download() {
    setGenerating(true)
    try {
      await downloadBrandedItineraryPdf(data)
      setError('')
    } catch (reason) {
      console.error('Could not generate the itinerary PDF.', reason)
      setError('We could not create the PDF. Please try again or contact AVELOF for help.')
    } finally {
      setGenerating(false)
    }
  }

  return <div className="itinerary-pdf-action">
    <button className={className} type="button" onClick={download} disabled={generating}><Download size={17} aria-hidden="true" />{generating ? 'Preparing PDF…' : label}</button>
    {error && <p className="enquiry-error" role="alert">{error}</p>}
  </div>
}
