export const driverVehicleIds = ['swift-dzire', 'ertiga', 'innova', 'innova-crysta', 'tempo-traveller', 'tempo-traveller-14', 'tempo-traveller-20', 'bus-26'] as const
export const driverVehicleOptions = driverVehicleIds.map((id) => ({
  id, label: id === 'swift-dzire' ? 'Sedan' : ({
    ertiga: 'Maruti Suzuki Ertiga',
    innova: 'Toyota Innova',
    'innova-crysta': 'Toyota Innova Crysta',
    'tempo-traveller': 'Tempo Traveller 12-seater',
    'tempo-traveller-14': 'Tempo Traveller 14-seater',
    'tempo-traveller-20': 'Tempo Traveller 20-seater',
    'bus-26': 'Bus 26-seater',
  }[id]),
}))

export type DriverVehicleId = typeof driverVehicleIds[number]
