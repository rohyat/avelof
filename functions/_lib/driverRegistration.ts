import { z } from 'zod'
import { driverDetailsSchema, driverPrivateSchema } from '../../src/services/driverSchema.ts'
import { driverVehicleOptions } from '../../src/data/driverRegistration.ts'
import { rentalCars } from '../../src/data/catalog.ts'
import { customerAccessCode } from './enquiryAccess.ts'
export interface DriverRow {
  id: string; driver_id: string; phone: string; private_json: string; details_json: string;
  photo_keys_json: string; submitted_price: number; price: number; status: 'pending' | 'approved' | 'rejected';
  version: number; owner_note: string; payload_hash: string; created_at: string;
}
export const driverColumns = 'id, driver_id, phone, private_json, details_json, photo_keys_json, submitted_price, price, status, version, owner_note, payload_hash, created_at'
export const driverPhotoKeys = (row: Pick<DriverRow, 'photo_keys_json'>) => z.array(z.string().regex(/^drivers\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/0\.jpg$/)).length(1).parse(JSON.parse(row.photo_keys_json))
export function maskedDriverPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return digits.length > 5 ? `${digits.slice(0, 3)}${'*'.repeat(digits.length - 5)}${digits.slice(-2)}` : '***'
}
export function publicDriver(row: DriverRow) {
  const details = driverDetailsSchema.parse(JSON.parse(row.details_json))
  const vehicle = driverVehicleOptions.find(({ id }) => id === details.vehicleId)
  const catalogVehicle = rentalCars.find(({ id }) => id === details.vehicleId)
  if (!vehicle || !catalogVehicle) throw new Error('Registered driver vehicle is unavailable in the catalog.')
  return { ...details, id: row.id, driverId: row.driver_id, vehicleName: vehicle.label, maskedPhone: maskedDriverPhone(row.phone), price: row.price, photo: `/api/driver-images/${row.id}/0` }
}
export function adminDriver(row: DriverRow) {
  return { ...publicDriver(row), ...driverPrivateSchema.parse(JSON.parse(row.private_json)), submittedPrice: row.submitted_price, status: row.status, version: row.version, ownerNote: row.owner_note, createdAt: row.created_at }
}
export const driverAccessCode = (secret: string, id: string) => customerAccessCode(secret, `driver:${id}`)
