export const unionCabRefundNote = 'If you select and pay AVELOF for a union cab but do not use it, AVELOF will refund the amount you paid for that cab.'

export const unionCabOptions = [
  {
    id: 'pahalgam',
    label: 'Add union cabs in Pahalgam',
    description: 'For visits to Aru Valley, Betaab Valley and Chandanwari. Local access rules and route availability must be confirmed.',
  },
  {
    id: 'gulmarg',
    label: 'Add union cabs in Gulmarg',
    description: 'Union cabs may be required in bad weather, depending on road conditions and local rules.',
  },
] as const

export function unionCabsForPlaces(ids: string[], placeIds: string[]) {
  return unionCabOptions.filter((option) => ids.includes(option.id) && placeIds.includes(option.id))
}
