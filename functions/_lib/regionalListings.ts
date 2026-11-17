import { driverLocationsByRegion, hotelLocationsByRegion } from '../../src/data/regions.ts'

function sqlStrings(values: readonly string[]) {
  return [...new Set(values)].map((value) => `'${value.replaceAll("'", "''")}'`).join(', ')
}

const ladakhLocations = sqlStrings([...hotelLocationsByRegion.Ladakh, ...driverLocationsByRegion.Ladakh])
const jammuLocations = sqlStrings([...hotelLocationsByRegion.Jammu, ...driverLocationsByRegion.Jammu])

// Older registrations have a location but no explicit region.
export const listingRegionSql = `COALESCE(json_extract(details_json, '$.region'), CASE WHEN json_extract(details_json, '$.location') IN (${ladakhLocations}) THEN 'Ladakh' WHEN json_extract(details_json, '$.location') IN (${jammuLocations}) THEN 'Jammu' ELSE 'Kashmir' END)`
