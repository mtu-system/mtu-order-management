import { createClient } from '@/lib/supabase/client'

// ==========================================
// SYNC ORDER STATUS
// ==========================================
// Dipanggil setiap kali status sebuah order_truck berubah
// (Passed/Failed HSE, Ganti Detail Truk, Pakai Vendor, dst).
//
// Order-level status HARUS mencerminkan kondisi TERKINI semua
// unit internal-nya -- bukan cuma di-update maju sekali lalu
// dibiarkan nyangkut kalau kondisinya berubah lagi (unit yang
// tadinya Passed lalu diganti jadi Failed, dst).
//
// Sengaja HANYA menangani tahap sebelum Ready to Depart.
// Transisi ke 'ready_to_depart' tetap lewat tombol manual
// "Tandai Ready to Depart" -- tidak disentuh fungsi ini.
export async function syncOrderStatus(orderId: string) {
  const supabase = createClient()

  const { data: trucks, error: trucksError } = await supabase
    .from('order_trucks')
    .select('status, source')
    .eq('order_id', orderId)

  if (trucksError) {
    console.error('SYNC ORDER STATUS - FETCH TRUCKS ERROR:', trucksError)
    return { error: trucksError }
  }

  const activeTrucks = (trucks || []).filter(
    (truck) =>
      truck.source === 'internal' &&
      truck.status !== 'cancelled' &&
      truck.status !== 'departed' &&
      truck.status !== 'finished'
  )

  let nextStatus: string | null = null

  if (
    activeTrucks.length === 0 ||
    activeTrucks.every((truck) => truck.status === 'ready_to_depart')
  ) {
    // Tidak ada unit internal tersisa (semua Vendor/dibatalkan), atau
    // semua unit internal sudah Ready to Depart -> order selesai.
    nextStatus = 'ready_to_depart'
  } else if (
    activeTrucks.every((truck) => truck.status === 'ready_loading')
  ) {
    nextStatus = 'ready_loading'
  } else if (activeTrucks.some((truck) => truck.status === 'inspection')) {
    nextStatus = 'inspection'
  } else if (
    activeTrucks.some(
      (truck) => truck.status === 'waiting_hse' || truck.status === 'failed'
    )
  ) {
    nextStatus = 'waiting_hse'
  }

  if (nextStatus) {
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: nextStatus,
        ...(nextStatus === 'ready_to_depart'
          ? { departure_ready_at: new Date().toISOString() }
          : {}),
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('SYNC ORDER STATUS - UPDATE ERROR:', updateError)
      return { error: updateError }
    }
  }

  return { error: null }
}