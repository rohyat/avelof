import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function BackButton() {
  const navigate = useNavigate()
  function goBack() {
    if (typeof window.history.state?.idx === 'number' && window.history.state.idx > 0) navigate(-1)
    else navigate('/', { replace: true })
  }
  return <span className="page-back-inline"><button type="button" className="page-back-button" onClick={goBack} aria-label="Go back" title="Go back"><ArrowLeft size={20} aria-hidden="true" /></button></span>
}
