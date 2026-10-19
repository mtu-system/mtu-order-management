export type TripStatus =
  | 'finished_loading'
  | 'on_going'
  | 'finished_unloading'
  | 'complete'

export const TRIP_FLOW: TripStatus[] = [
  'finished_loading',
  'on_going',
  'finished_unloading',
  'complete',
]

export const TRIP_LABEL: Record<TripStatus, string> = {
  finished_loading: 'Finished Loading',
  on_going: 'On Going',
  finished_unloading: 'Finished Unloading',
  complete: 'Complete',
}

export const TRIP_BADGE: Record<TripStatus, string> = {
  finished_loading: 'bg-blue-100 text-blue-700',
  on_going: 'bg-amber-100 text-amber-800',
  finished_unloading: 'bg-violet-100 text-violet-700',
  complete: 'bg-emerald-100 text-emerald-700',
}

export const TRIP_TIME_COLUMN: Record<TripStatus, string> = {
  finished_loading: 'finished_loading_at',
  on_going: 'on_going_at',
  finished_unloading: 'finished_unloading_at',
  complete: 'completed_at',
}

export function nextTripStatus(current: TripStatus | null): TripStatus | null {
  const index = current ? TRIP_FLOW.indexOf(current) : -1
  return TRIP_FLOW[index + 1] ?? null
}

export function prevTripStatus(current: TripStatus | null): TripStatus | null {
  if (!current) return null
  const index = TRIP_FLOW.indexOf(current)
  return index > 0 ? TRIP_FLOW[index - 1] : null
}

export type MonitoringRow = {
  id: string
  orderId: string
  customer: string
  pkNumber: string | null
  rftTrJob: string | null
  trip: string | null
  vehicleType: string
  source: string | null
  vendorName: string | null
  plateNumber: string | null
  noBuntut: string | null
  driverName: string | null
  tripStatus: TripStatus | null
  times: Record<TripStatus, string | null>
}