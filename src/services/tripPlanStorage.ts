const tripPlanStoragePrefix = 'avelof:trip-plan:'
export const tripReturnStorageKey = 'avelof:trip-return-section'

export function tripPlanStorageKey(sectionId: string) {
  return `${tripPlanStoragePrefix}${sectionId}`
}

export function clearSavedTripPlan(sectionId: string) {
  try {
    sessionStorage.removeItem(tripPlanStorageKey(sectionId))
    if (sessionStorage.getItem(tripReturnStorageKey) === sectionId) sessionStorage.removeItem(tripReturnStorageKey)
  } catch {
    return
  }
}