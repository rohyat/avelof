import { useEffect, useId, useRef, useState } from 'react'
import { Crosshair, MapPin } from 'lucide-react'
import type { Map as LeafletMap, CircleMarker } from 'leaflet'
import type { MapCoordinates } from '../services/mapLocation'
import { googleMapsLocationUrl, mapCoordinates } from '../services/mapLocation'
import 'leaflet/dist/leaflet.css'

const destinationCentres: Record<string, [number, number]> = {
  Srinagar: [34.0837, 74.7973], Gulmarg: [34.0484, 74.3805],
  Pahalgam: [34.0159, 75.3189], Sonamarg: [34.3031, 75.2931],
  Doodhpathri: [33.895, 74.575], Yusmarg: [33.829, 74.663], Gurez: [34.633, 74.835],
}

export default function LocationPicker({ value, onChange, destination, disabled = false }: {
  value?: MapCoordinates; onChange: (value: MapCoordinates | undefined) => void; destination: string; disabled?: boolean
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [candidate, setCandidate] = useState<MapCoordinates | undefined>(value)
  const [latitude, setLatitude] = useState(value ? String(value.latitude) : '')
  const [longitude, setLongitude] = useState(value ? String(value.longitude) : '')
  const [error, setError] = useState('')
  const [tileError, setTileError] = useState(false)
  const [locating, setLocating] = useState(false)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [ready, setReady] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<CircleMarker | null>(null)
  const disabledRef = useRef(disabled)
  const gpsRequest = useRef(0)
  const initialView = useRef(value ? [value.latitude, value.longitude] as [number, number] : destinationCentres[destination] ?? destinationCentres.Srinagar)
  const initialZoom = useRef(value ? 17 : 12)

  useEffect(() => { disabledRef.current = disabled }, [disabled])
  useEffect(() => () => { gpsRequest.current++ }, [])

  function choosePin(coordinates: MapCoordinates) {
    setCandidate(coordinates)
    setLatitude(String(coordinates.latitude))
    setLongitude(String(coordinates.longitude))
    setAccuracy(null)
    setError('')
  }

  useEffect(() => {
    if (!open) return
    let active = true
    let map: LeafletMap | undefined
    let observer: ResizeObserver | undefined
    void import('leaflet').then((L) => {
      if (!active || !containerRef.current) return
      map = L.map(containerRef.current, { scrollWheelZoom: false, zoomControl: true }).setView(initialView.current, initialZoom.current)
      mapRef.current = map
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        referrerPolicy: 'strict-origin-when-cross-origin',
      }).on('tileerror', () => { if (active) setTileError(true) }).addTo(map)
      markerRef.current = L.circleMarker(initialView.current, { radius: 10, weight: 3, color: '#fff', fillColor: '#19594e', opacity: 0, fillOpacity: 0 }).addTo(map)
      map.on('click', (event) => {
        if (!disabledRef.current) choosePin({ latitude: Number(event.latlng.lat.toFixed(7)), longitude: Number(event.latlng.wrap().lng.toFixed(7)) })
      })
      observer = new ResizeObserver(() => map?.invalidateSize())
      observer.observe(containerRef.current)
      setReady(true)
    }).catch(() => { if (active) setError('The map could not load. Retry opening it, or enter coordinates below.') })
    return () => { active = false; observer?.disconnect(); map?.remove(); mapRef.current = null; markerRef.current = null }
  }, [open])

  useEffect(() => {
    if (!ready) return
    markerRef.current?.setStyle({ opacity: candidate ? 1 : 0, fillOpacity: candidate ? 1 : 0 })
    if (!candidate) return
    markerRef.current?.setLatLng([candidate.latitude, candidate.longitude])
    mapRef.current?.panTo([candidate.latitude, candidate.longitude])
  }, [candidate, ready])

  function useCurrentLocation() {
    setError('')
    if (!navigator.geolocation) { setError('Location access is unavailable. Tap the map or enter coordinates instead.'); return }
    const request = ++gpsRequest.current
    setLocating(true)
    navigator.geolocation.getCurrentPosition((position) => {
      if (request !== gpsRequest.current) return
      setLocating(false)
      if (disabledRef.current) return
      const coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude }
      choosePin(coordinates)
      setAccuracy(position.coords.accuracy)
      mapRef.current?.setView([coordinates.latitude, coordinates.longitude], 18)
    }, (failure) => {
      if (request !== gpsRequest.current) return
      setLocating(false)
      setError(failure.code === 1 ? 'Location permission was denied. Allow it in your browser settings, or tap the map to place your pin.' : 'Your location could not be determined. Try outdoors with a better signal, or place the pin manually.')
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  }

  function confirmPin() {
    const coordinates = latitude.trim() && longitude.trim() ? mapCoordinates({ latitude: Number(latitude), longitude: Number(longitude) }) : undefined
    if (!coordinates) { setError('Enter both valid coordinates: latitude -90 to 90 and longitude -180 to 180, or choose a point on the map.'); return }
    choosePin(coordinates)
    onChange(coordinates)
    setError('')
  }

  return <section className="location-picker review-text-field" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}><MapPin size={18} aria-hidden="true" /> Exact business location <span className="optional">Optional</span></h3>
    <p>Pin the public entrance of your hotel, restaurant or shop, not your home. The pin will be public only after approval. Keep the destination above for filtering.</p>
    {value && <p className="location-confirmed" role="status">Confirmed pin: {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}. <a href={googleMapsLocationUrl(value)} target="_blank" rel="noopener noreferrer">Check on Google Maps</a></p>}
    {!value && <p>No exact pin saved yet.</p>}
    {!open ? <button className="button button-outline" type="button" disabled={disabled} onClick={() => { initialView.current = candidate ? [candidate.latitude, candidate.longitude] : destinationCentres[destination] ?? destinationCentres.Srinagar; initialZoom.current = candidate ? 17 : 12; setOpen(true); setError(''); setTileError(false); setReady(false) }}>Open map to choose a pin</button> : <>
      <p className="privacy-note">Map tiles load from OpenStreetMap and share your IP address and viewed map area with that provider. No contact details are sent. Current location is requested only when you press the button below.</p>
      <div className="location-map" ref={containerRef} role="region" aria-label="Business location map. Tap to place a pin." />
      {tileError && <p role="alert" className="enquiry-error">Map tiles could not load. Check your connection and reopen the map, or use the coordinate fields below.</p>}
      <div className="location-picker-actions">
        <button type="button" className="button button-outline" disabled={disabled || locating} onClick={useCurrentLocation}><Crosshair size={16} aria-hidden="true" />{locating ? 'Finding your location...' : 'Use my current location'}</button>
        <button type="button" className="button button-outline" disabled={disabled || !ready} onClick={() => {
          const centre = mapRef.current?.getCenter().wrap()
          if (centre) choosePin({ latitude: Number(centre.lat.toFixed(7)), longitude: Number(centre.lng.toFixed(7)) })
        }}>Use map centre</button>
      </div>
      <p>Tap the exact entrance, or pan/zoom and use the map centre. You can also enter coordinates for keyboard access or when tiles are unavailable. Then press Confirm pin.</p>
      {accuracy !== null && <p role="status">Device-reported accuracy: approximately {Math.round(accuracy)} metres. Check and adjust the pin before confirming.</p>}
      <div className="location-coordinate-fields">
        <label htmlFor={`${id}-lat`}>Pin latitude<input id={`${id}-lat`} type="number" step="any" min="-90" max="90" value={latitude} disabled={disabled} onChange={(event) => { setLatitude(event.target.value); setAccuracy(null) }} /></label>
        <label htmlFor={`${id}-lng`}>Pin longitude<input id={`${id}-lng`} type="number" step="any" min="-180" max="180" value={longitude} disabled={disabled} onChange={(event) => { setLongitude(event.target.value); setAccuracy(null) }} /></label>
      </div>
      <p role="status">{candidate ? 'Pin preview selected. Confirm it to include it in your submission.' : 'Choose a point; the starting map centre is not a saved business location.'}</p>
      <div className="location-picker-actions"><button type="button" className="button button-dark" disabled={disabled || locating} onClick={confirmPin}>Confirm pin</button><button type="button" className="button button-outline" disabled={disabled} onClick={() => { gpsRequest.current++; setLocating(false); setOpen(false) }}>Close map</button></div>
    </>}
    {value && <button className="text-link" type="button" disabled={disabled} onClick={() => { gpsRequest.current++; setLocating(false); onChange(undefined); setCandidate(undefined); setLatitude(''); setLongitude(''); setAccuracy(null); setError('') }}>Remove saved pin</button>}
    {error && <p role="alert" className="enquiry-error">{error}</p>}
  </section>
}
