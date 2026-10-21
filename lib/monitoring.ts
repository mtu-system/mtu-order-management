import type { SupabaseClient } from '@supabase/supabase-js'
import type { MonitoringRow, TripStatus } from '@/lib/trip-status'

type RawTruck = {
  id: string
  order_id: string
  source: string | null
  vehicle_type: string
  vendor_name: string | null
  no_buntut: string | null
  plate_number: string | null
  driver_name: string | null
  trip_status: TripStatus | null
  destination_fence_id: string | null
  finished_loading_at: string | null
  on_going_at: string | null
  finished_unloading_at: string | null
  completed_at: string | null
  orders:
    | {
        customer: string
        pk_number: string | null
        rft_tr_job: string | null
        trip: string | null
      }
    | {
        customer: string
        pk_number: string | null
        rft_tr_job: string | null
        trip: string | null
      }[]
    | null
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// Unit yang sudah siap berangkat atau sudah punya status perjalanan.
// Unit Complete lebih dari 7 hari disembunyikan supaya daftar tidak membengkak.
export async function loadMonitoringRows(
  supabase: SupabaseClient,
  options: { createdBy?: string } = {}
): Promise<MonitoringRow[]> {
  let query = supabase
    .from('order_trucks')
    .select(`
      id,
      order_id,
      source,
      vehicle_type,
      vendor_name,
      no_buntut,
      plate_number,
      driver_name,
      trip_status,
      destination_fence_id,
      finished_loading_at,
      on_going_at,
      finished_unloading_at,
      completed_at,
      orders!inner (
        customer,
        pk_number,
        rft_tr_job,
        trip
      )
    `)
    .or(
      'status.in.(ready_to_depart,driver_started,departed,finished),trip_status.not.is.null'
    )
    .limit(1000)

  if (options.createdBy) {
    query = query.eq('orders.created_by', options.createdBy)
  }

  const { data, error } = await query

  if (error) {
    console.error('MONITORING LOAD ERROR:', error)
    return []
  }

  const now = Date.now()

  return ((data || []) as unknown as RawTruck[])
    .filter((truck) => {
      if (truck.trip_status !== 'complete' || !truck.completed_at) return true
      return now - new Date(truck.completed_at).getTime() < SEVEN_DAYS_MS
    })
    .map((truck) => {
      const order = Array.isArray(truck.orders) ? truck.orders[0] : truck.orders

      return {
        id: truck.id,
        orderId: truck.order_id,
        customer: order?.customer || '-',
        pkNumber: order?.pk_number || null,
        rftTrJob: order?.rft_tr_job || null,
        trip: order?.trip || null,
        vehicleType: truck.vehicle_type,
        source: truck.source,
        vendorName: truck.vendor_name,
        plateNumber: truck.plate_number,
        noBuntut: truck.no_buntut,
        driverName: truck.driver_name,
        tripStatus: truck.trip_status,
        destinationFenceId: truck.destination_fence_id,
        times: {
          finished_loading: truck.finished_loading_at,
          on_going: truck.on_going_at,
          finished_unloading: truck.finished_unloading_at,
          complete: truck.completed_at,
        },
      }
    })
}