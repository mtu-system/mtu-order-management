import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/app/components/dashboard-shell'
import VendorUnitsPanel from '@/app/vm/components/vendor-units-panel'

export default async function VmDashboardPage() {
  const user = await requireRole(['vm'])

  const supabase = await createClient()

  const { data: trucks, error } = await supabase
    .from('order_trucks')
    .select(`
      id,
      order_id,
      vehicle_type,
      no_buntut,
      plate_number,
      driver_name,
      driver_phone,
      vendor_name,
      status,
      created_at,
      orders (
        customer,
        pk_number,
        rft_tr_job,
        trip,
        status
      )
    `)
    .eq('source', 'vendor')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('GET VM UNITS ERROR:', error)
  }

  const rows = (trucks || []).map((truck: any) => {
    const order = truck.orders

    const isFilled = Boolean(
      truck.vendor_name &&
        truck.vendor_name !== 'Vendor / VM' &&
        truck.plate_number &&
        truck.driver_name &&
        truck.driver_phone
    )

    return {
      id: truck.id,
      orderId: truck.order_id,
      vehicleType: truck.vehicle_type,
      noBuntut: truck.no_buntut,
      plateNumber: truck.plate_number,
      driverName: truck.driver_name,
      driverPhone: truck.driver_phone,
      vendorName: isFilled ? truck.vendor_name : null,
      status: truck.status,
      isFilled,
      customer: order?.customer || '-',
      pkNumber: order?.pk_number || null,
      rftTrJob: order?.rft_tr_job || null,
      trip: order?.trip || null,
      orderStatus: order?.status || null,
      createdAt: truck.created_at,
    }
  })

  const totalCount = rows.length
  const pendingCount = rows.filter((row) => !row.isFilled).length
  const filledCount = totalCount - pendingCount

  return (
    <DashboardShell user={user}>
      <div className="mb-5">
        <h1 className="text-lg font-extrabold text-gray-900">
          Unit Vendor / VM
        </h1>
        <p className="mt-0.5 text-[13px] text-gray-500">
          Lengkapi data PT Vendor, No Unit, dan Driver untuk unit vendor yang
          dialokasikan Operational. Data order (Customer, PK, Trip) sudah
          otomatis terbawa dari Operational — tidak perlu diinput ulang.
        </p>
      </div>

      <VendorUnitsPanel
        rows={rows}
        totalCount={totalCount}
        pendingCount={pendingCount}
        filledCount={filledCount}
      />
    </DashboardShell>
  )
}
