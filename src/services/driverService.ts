import { useEffect, useState } from 'react'
import { z } from 'zod'
import { adminDriverSchema, driverReceiptSchema, driverStatusResultSchema, publicDriverSchema } from './driverSchema'
import type { DriverSubmission, PublicDriver } from './driverSchema'
import type { HotelStatus } from './hotelSchema'
import { HotelError, hotelErrorText, requestHotel } from './hotelService'
import type { RentalCar } from '../types'
import { rentalCars } from '../data/catalog'
const pagination = { total: z.number().int().min(0), page: z.number().int().min(1), pageSize: z.literal(25) }
const adminList = z.object({ ...pagination, drivers: z.array(adminDriverSchema) })
const publicList = z.object({ ...pagination, drivers: z.array(publicDriverSchema) })
export async function saveDriver(data: DriverSubmission, photo: Blob) {
  const body = new FormData()
  body.append('details', JSON.stringify(data))
  body.append('photos', photo, 'driver-portrait.jpg')
  const receipt = driverReceiptSchema.parse(await requestHotel('/api/drivers', 'POST', body))
  if (receipt.id !== data.id) throw new HotelError('Driver storage could not be confirmed. Retry with the same form.', 503)
  return receipt
}
export async function lookupDriver(identifier: string, accessCode: string) {
  return z.object({ driver: driverStatusResultSchema }).parse(await requestHotel('/api/drivers', 'POST', { identifier, accessCode })).driver
}
export async function loadAdminDrivers(page: number, status: HotelStatus | 'all', signal?: AbortSignal) {
  return adminList.parse(await requestHotel(`/api/drivers?${new URLSearchParams({ scope: 'admin', page: String(page), status })}`, 'GET', undefined, signal))
}
export async function moderateDriver(id: string, version: number, status: HotelStatus, price: number, ownerNote: string, vehicleNumber: string) {
  return z.object({ driver: adminDriverSchema }).parse(await requestHotel('/api/drivers', 'PATCH', { id, version, status, price, ownerNote, vehicleNumber })).driver
}
export async function deleteDriver(id: string, version: number) {
  return z.object({ deleted: z.literal(true), id: z.uuidv4() }).parse(await requestHotel('/api/drivers', 'DELETE', { id, version }))
}
export async function loadPublicDrivers(signal?: AbortSignal, id?: string) {
  const drivers: PublicDriver[] = []
  for (let page = 1; ; page++) {
    const listing = publicList.parse(await requestHotel(`/api/drivers?${new URLSearchParams({ page: String(page), ...(id ? { id } : {}) })}`, 'GET', undefined, signal))
    drivers.push(...listing.drivers)
    if (page * listing.pageSize >= listing.total) return drivers
  }
}
function catalogDriver(driver: PublicDriver): RentalCar {
  const vehicle = rentalCars.find(({ id }) => id === driver.vehicleId)
  if (!vehicle) throw new Error('Registered driver vehicle is missing from the vehicle catalog.')
  return { kind: 'car', id: driver.id, registeredDriverId: driver.driverId, driverDisplayName: driver.fullName,
    driverPhoto: driver.photo, maskedPhone: driver.maskedPhone, vehicleNumber: driver.vehicleNumber, maskedLicenceNumber: driver.maskedLicenceNumber,
    name: driver.vehicleName, category: driver.vehicleName,
    driverAverageRating: driver.averageRating, driverReviewCount: driver.reviewCount,
    location: driver.location, seats: driver.seats, price: driver.price,
    image: vehicle.image, gallery: vehicle.gallery,
    description: `${driver.fullName} · ${driver.location}`,
    luggage: 'Confirm with AVELOF', ac: true, tripTypes: [], conditions: [] }
}
export async function loadPublicDriverByDisplayId(driverId: string, signal?: AbortSignal) {
  const listing = publicList.parse(await requestHotel(`/api/drivers?${new URLSearchParams({ driverId })}`, 'GET', undefined, signal))
  return listing.drivers[0] ?? null
}
export function useRegisteredDrivers(enabled: boolean, id?: string) {
  const key = enabled ? id ?? 'all' : ''
  const [state, setState] = useState<{ key: string; cars: RentalCar[]; loading: boolean; error: string }>({ key: '', cars: [], loading: enabled, error: '' })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    loadPublicDrivers(controller.signal, id).then((drivers) => setState({ key, cars: drivers.map(catalogDriver), loading: false, error: '' })).catch((error: unknown) => { if (!controller.signal.aborted) setState({ key, cars: [], loading: false, error: hotelErrorText(error) }) })
    return () => controller.abort()
  }, [enabled, id, key, revision])
  return { ...(state.key === key ? state : { cars: [], loading: enabled, error: '' }), reload: () => { setState({ key, cars: [], loading: true, error: '' }); setRevision((current) => current + 1) } }
}
export const driverSelectionValue = (car: RentalCar) => car.registeredDriverId ? `${car.name} (${car.registeredDriverId})` : car.name
