import { createClient } from '@/lib/supabase/server'
import { Building2 } from 'lucide-react'

type VMUnitsPanelProps = {
  orderId: string
}

export default async function VMUnitsPanel({ orderId }: VMUnitsPanelProps) {
  const supabase = await createClient()

  const { data: vmTrucks, error } = await supabase
    .from('order_trucks')
    .select(`
      id,
      vehicle_type,
      vendor_name,
      plate_number,
      driver_name,
      status
    `)
    .eq('order_id', orderId)
    .eq('source', 'vendor')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('GET VM UNITS ERROR:', error)
  }

  const trucks = vmTrucks || []

  if (!trucks.length) {
    return null
  }

  return (
    <div className="mb-6 rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-gray-900">
            <Building2 className="h-4.5 w-4.5 text-violet-500" />
            Unit Vendor / VM
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Unit yang dipenuhi oleh Vendor. Tidak masuk pemeriksaan HSE
            internal.{' '}
            <span className="font-semibold text-gray-600">Read Only</span>
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-violet-100 px-3 py-1.5 text-xs font-bold text-violet-700">
          {trucks.length} Unit VM
        </span>
      </div>

      <div className="space-y-3">
        {trucks.map((truck, index) => (
          <div
            key={truck.id}
            className="rounded-xl border border-violet-100 bg-violet-50/40 p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                  {index + 1}
                </div>
                <div>
                  <p className="font-bold text-gray-900">
                    {truck.vehicle_type}
                  </p>
                  <p className="text-sm text-gray-600">
                    {truck.vendor_name || 'Vendor / VM'}
                  </p>
                  {truck.plate_number && (
                    <p className="mt-1 text-xs text-gray-400">
                      {truck.plate_number}
                      {truck.driver_name ? ` · ${truck.driver_name}` : ''}
                    </p>
                  )}
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                VM
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}