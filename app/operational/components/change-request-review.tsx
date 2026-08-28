'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Check,
  X,
  Loader2,
  ShieldAlert,
  Plus,
} from 'lucide-react'
import { logOrderHistory, logUnitHistory } from '@/lib/history'

type Truck = {
  id: string
  vehicle_type: string
  no_buntut: string | null
  plate_number: string | null
  driver_name: string | null
  status: string
}

type ChangeRequest = {
  id: string
  change_type: string
  requested_quantity: number | null
  requested_vehicle_type: string | null
  requested_value: string | null
  reason: string | null
  status: string
}

type ChangeRequestReviewProps = {
  orderId: string
  request: ChangeRequest
  trucks: Truck[]
}

type NewUnit = {
  vehicle_type: string
  source: 'internal' | 'vendor'
  vendor_name: string
  no_buntut: string
  plate_number: string
  driver_name: string
  driver_phone: string
}

function createEmptyUnit(): NewUnit {
  return {
    vehicle_type: '',
    source: 'internal',
    vendor_name: '',
    no_buntut: '',
    plate_number: '',
    driver_name: '',
    driver_phone: '',
  }
}

const changeTypeLabels: Record<string, string> = {
  reduce_unit: 'Kurangi Unit',
  add_unit: 'Tambah Unit',
  change_vehicle: 'Ganti Jenis Unit',
  change_trip: 'Ubah Trip',
  change_pk: 'Ubah PK',
  change_rft: 'Ubah RFT/TR/Job',
  change_customer: 'Ubah Customer',
  change_instruction: 'Ubah Instruksi',
  change_note: 'Ubah Catatan',
  cancel_order: 'Batalkan Order',
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#01236A] focus:ring-2 focus:ring-[#01236A]/10'

export default function ChangeRequestReview({
  orderId,
  request,
  trucks,
}: ChangeRequestReviewProps) {
  const router = useRouter()
  const supabase = createClient()

  const [selectedTruckIds, setSelectedTruckIds] = useState<string[]>([])

  const [newUnits, setNewUnits] = useState<NewUnit[]>(
    request.change_type === 'add_unit'
      ? Array.from(
          { length: request.requested_quantity || 0 },
          () => createEmptyUnit()
        )
      : []
  )

  const [replacementUnits, setReplacementUnits] = useState<NewUnit[]>([])
  const [loading, setLoading] = useState(false)

  const requestedQuantity = request.requested_quantity || 0

  const hasTruckDetails = trucks.length > 0

  const selectableTrucks = trucks.filter(
    (truck) =>
      truck.status !== 'failed' &&
      truck.status !== 'cancelled' &&
      truck.status !== 'departed' &&
      truck.status !== 'finished'
  )

  function updateNewUnit(index: number, field: keyof NewUnit, value: string) {
    setNewUnits((current) =>
      current.map((unit, unitIndex) =>
        unitIndex !== index ? unit : { ...unit, [field]: value }
      )
    )
  }

  function updateReplacementUnit(
    index: number,
    field: keyof NewUnit,
    value: string
  ) {
    setReplacementUnits((current) =>
      current.map((unit, unitIndex) =>
        unitIndex !== index ? unit : { ...unit, [field]: value }
      )
    )
  }

  function toggleTruck(truckId: string) {
    setSelectedTruckIds((current) => {
      let next: string[]

      if (current.includes(truckId)) {
        next = current.filter((id) => id !== truckId)
      } else {
        if (current.length >= requestedQuantity) {
          return current
        }
        next = [...current, truckId]
      }

      setReplacementUnits((units) =>
        Array.from(
          { length: next.length },
          (_, index) =>
            units[index] || {
              ...createEmptyUnit(),
              vehicle_type: request.requested_vehicle_type || '',
            }
        )
      )

      return next
    })
  }

  function validateNewUnits() {
    if (newUnits.length !== requestedQuantity) {
      alert(`Detail ${requestedQuantity} unit harus diisi.`)
      return false
    }

    for (let index = 0; index < newUnits.length; index++) {
      const unit = newUnits[index]

      if (!unit.vehicle_type.trim()) {
        alert(`Jenis kendaraan Unit ${index + 1} wajib diisi.`)
        return false
      }

      if (!unit.plate_number.trim()) {
        alert(`Plat nomor Unit ${index + 1} wajib diisi.`)
        return false
      }

      if (!unit.driver_name.trim()) {
        alert(`Nama driver Unit ${index + 1} wajib diisi.`)
        return false
      }

      if (!unit.driver_phone.trim()) {
        alert(`No. HP driver Unit ${index + 1} wajib diisi.`)
        return false
      }

      if (unit.source === 'vendor' && !unit.vendor_name.trim()) {
        alert(`Nama vendor Unit ${index + 1} wajib diisi.`)
        return false
      }
    }

    return true
  }

  async function handleApproveWithoutTrucks() {
    if (loading) return

    const confirmed = window.confirm(
      request.change_type === 'reduce_unit'
        ? `Kurangi ${requestedQuantity} unit dari order ini?\n\nDetail kendaraan belum diisi Operational, jadi sistem akan langsung mengurangi kebutuhan unit.`
        : request.change_type === 'add_unit'
        ? `Tambahkan ${requestedQuantity} unit ke kebutuhan order ini?\n\nDetail kendaraan belum diisi Operational, jadi sistem hanya akan menambah kebutuhan unit.`
        : `Ubah ${requestedQuantity} unit menjadi ${request.requested_vehicle_type}?\n\nDetail kendaraan belum diisi Operational, jadi sistem hanya akan mengubah kebutuhan unit.`
    )

    if (!confirmed) return

    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('Session login tidak ditemukan.')
        return
      }

      const { error } = await supabase.rpc(
        'apply_change_request_without_trucks',
        { p_request_id: request.id }
      )

      if (error) {
        console.error('APPLY CHANGE WITHOUT TRUCK ERROR:', error)
        alert(error.message)
        return
      }

      const { data: orderAfter, error: orderAfterError } = await supabase
        .from('orders')
        .select('quantity')
        .eq('id', orderId)
        .single()

      if (orderAfterError) {
        console.error('GET ORDER AFTER AUTO CHANGE ERROR:', orderAfterError)
      }

      if (orderAfter) {
        await logOrderHistory({
          orderId,
          action: request.change_type,
          fieldName: 'quantity',
          oldValue: '-',
          newValue: String(orderAfter.quantity),
          reason: request.reason,
          changedBy: user.id,
        })
      }

      const { error: activityError } = await supabase
        .from('activity_logs')
        .insert({
          order_id: orderId,
          user_id: user.id,
          action: 'AUTO_APPROVE_CHANGE_REQUEST_NO_TRUCKS',
          old_value: request.change_type,
          new_value: JSON.stringify({
            requested_quantity: requestedQuantity,
            requested_vehicle_type: request.requested_vehicle_type,
            mode: 'without_trucks',
          }),
        })

      if (activityError) {
        console.error('AUTO CHANGE ACTIVITY LOG ERROR:', activityError)
      }

      if (request.change_type === 'reduce_unit') {
        alert(
          `${requestedQuantity} unit berhasil dikurangi.\n\nDetail truck belum ada, jadi perubahan langsung diterapkan ke jumlah kebutuhan order.`
        )
      } else if (request.change_type === 'add_unit') {
        alert(
          `${requestedQuantity} unit berhasil ditambahkan.\n\nDetail truck belum ada, jadi kebutuhan unit langsung diperbarui.`
        )
      } else {
        alert(
          `${requestedQuantity} unit berhasil diubah menjadi ${request.requested_vehicle_type}.\n\nDetail truck belum ada, jadi perubahan langsung diterapkan ke kebutuhan order.`
        )
      }

      setSelectedTruckIds([])
      setNewUnits([])
      setReplacementUnits([])

      router.refresh()
    } catch (error) {
      console.error('AUTO CHANGE WITHOUT TRUCK ERROR:', error)
      alert('Terjadi kesalahan saat menerapkan perubahan tanpa detail truck.')
    } finally {
      setLoading(false)
    }
  }

  async function handleApproveReduce() {
    if (loading) return

    if (!hasTruckDetails) {
      await handleApproveWithoutTrucks()
      return
    }

    if (selectedTruckIds.length !== requestedQuantity) {
      alert(`Pilih tepat ${requestedQuantity} unit yang akan dikurangi.`)
      return
    }

    const confirmed = window.confirm(
      `Kurangi ${requestedQuantity} unit dari order ini?`
    )

    if (!confirmed) return

    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('Session login tidak ditemukan.')
        return
      }

      const { data: orderBefore, error: orderBeforeError } = await supabase
        .from('orders')
        .select('quantity')
        .eq('id', orderId)
        .single()

      if (orderBeforeError) {
        alert(orderBeforeError.message)
        return
      }

      const { data: trucksBefore, error: trucksBeforeError } = await supabase
        .from('order_trucks')
        .select('id, status, vehicle_type, plate_number')
        .in('id', selectedTruckIds)

      if (trucksBeforeError) {
        alert(trucksBeforeError.message)
        return
      }

      const { error } = await supabase.rpc('approve_reduce_unit_request', {
        p_request_id: request.id,
        p_selected_truck_ids: selectedTruckIds,
      })

      if (error) {
        console.error('APPROVE REDUCE UNIT ERROR:', error)
        alert(error.message)
        return
      }

      const { data: orderAfter, error: orderAfterError } = await supabase
        .from('orders')
        .select('quantity')
        .eq('id', orderId)
        .single()

      if (!orderAfterError && orderAfter) {
        await logOrderHistory({
          orderId,
          action: 'reduce_unit',
          fieldName: 'quantity',
          oldValue: String(orderBefore.quantity),
          newValue: String(orderAfter.quantity),
          reason: request.reason,
          changedBy: user.id,
        })
      }

      for (const truck of trucksBefore || []) {
        await logUnitHistory({
          truckId: truck.id,
          orderId,
          action: 'reduce_unit',
          fieldName: 'status',
          oldValue: truck.status,
          newValue: 'cancelled',
          reason: request.reason,
          changedBy: user.id,
        })
      }

      const { error: logError } = await supabase
        .from('activity_logs')
        .insert({
          order_id: orderId,
          user_id: user.id,
          action: 'approve_change_request',
          old_value: request.change_type,
          new_value: JSON.stringify({
            requested_quantity: requestedQuantity,
            selected_truck_ids: selectedTruckIds,
          }),
        })

      if (logError) {
        console.error('ACTIVITY LOG ERROR:', logError)
      }

      alert('Permintaan pengurangan unit berhasil disetujui dan diterapkan.')

      setSelectedTruckIds([])

      router.refresh()
    } catch (error) {
      console.error('APPROVE REDUCE ERROR:', error)
      alert('Terjadi kesalahan saat memproses pengurangan unit.')
    } finally {
      setLoading(false)
    }
  }

  async function handleApproveAdd() {
    if (loading) return

    if (!hasTruckDetails) {
      await handleApproveWithoutTrucks()
      return
    }

    if (!validateNewUnits()) {
      return
    }

    const confirmed = window.confirm(
      `Tambahkan ${requestedQuantity} unit baru ke order ini?`
    )

    if (!confirmed) return

    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('Session login tidak ditemukan.')
        return
      }

      const { data: orderBefore, error: orderBeforeError } = await supabase
        .from('orders')
        .select('quantity')
        .eq('id', orderId)
        .single()

      if (orderBeforeError) {
        alert(orderBeforeError.message)
        return
      }

      const { data: trucksBefore, error: trucksBeforeError } = await supabase
        .from('order_trucks')
        .select('id')
        .eq('order_id', orderId)

      if (trucksBeforeError) {
        alert(trucksBeforeError.message)
        return
      }

      const oldTruckIds = new Set(
        (trucksBefore || []).map((truck) => truck.id)
      )

      const { error } = await supabase.rpc('approve_add_unit_request', {
        p_request_id: request.id,
        p_units: newUnits.map((unit) => ({
          vehicle_type: unit.vehicle_type.trim(),
          source: unit.source,
          vendor_name:
            unit.source === 'vendor' ? unit.vendor_name.trim() : null,
          no_buntut: unit.no_buntut.trim() || null,
          plate_number: unit.plate_number.trim(),
          driver_name: unit.driver_name.trim(),
          driver_phone: unit.driver_phone.trim(),
        })),
      })

      if (error) {
        console.error('APPROVE ADD UNIT ERROR:', error)
        alert(error.message)
        return
      }

      const { data: orderAfter, error: orderAfterError } = await supabase
        .from('orders')
        .select('quantity')
        .eq('id', orderId)
        .single()

      if (orderAfterError) {
        alert(orderAfterError.message)
        return
      }

      await logOrderHistory({
        orderId,
        action: 'add_unit',
        fieldName: 'quantity',
        oldValue: String(orderBefore.quantity),
        newValue: String(orderAfter.quantity),
        reason: request.reason,
        changedBy: user.id,
      })

      const { data: trucksAfter, error: trucksAfterError } = await supabase
        .from('order_trucks')
        .select('id, status, vehicle_type, plate_number')
        .eq('order_id', orderId)

      if (!trucksAfterError) {
        const newlyAddedTrucks = (trucksAfter || []).filter(
          (truck) => !oldTruckIds.has(truck.id)
        )

        for (const truck of newlyAddedTrucks) {
          await logUnitHistory({
            truckId: truck.id,
            orderId,
            action: 'add_unit',
            fieldName: 'status',
            oldValue: null,
            newValue: truck.status,
            reason: request.reason,
            changedBy: user.id,
          })
        }
      }

      const { error: activityError } = await supabase
        .from('activity_logs')
        .insert({
          order_id: orderId,
          user_id: user.id,
          action: 'approve_add_unit',
          old_value: String(orderBefore.quantity),
          new_value: JSON.stringify({
            quantity: orderAfter.quantity,
            units: newUnits,
          }),
        })

      if (activityError) {
        console.error('ADD UNIT ACTIVITY LOG ERROR:', activityError)
      }

      alert(
        `${requestedQuantity} unit berhasil ditambahkan.\n\nStatus unit baru: Waiting HSE`
      )

      setNewUnits([])

      router.refresh()
    } catch (error) {
      console.error('APPROVE ADD UNIT ERROR:', error)
      alert('Terjadi kesalahan saat menambahkan unit.')
    } finally {
      setLoading(false)
    }
  }

  async function handleApproveChangeVehicle() {
    if (loading) return

    if (!request.requested_vehicle_type) {
      alert('Jenis kendaraan baru belum ditentukan.')
      return
    }

    if (!hasTruckDetails) {
      await handleApproveWithoutTrucks()
      return
    }

    if (selectedTruckIds.length !== requestedQuantity) {
      alert(`Pilih tepat ${requestedQuantity} unit yang akan diganti.`)
      return
    }

    if (replacementUnits.length !== requestedQuantity) {
      alert(`Detail ${requestedQuantity} unit pengganti harus diisi.`)
      return
    }

    const selectedTrucks = selectableTrucks.filter((truck) =>
      selectedTruckIds.includes(truck.id)
    )

    if (selectedTrucks.length !== requestedQuantity) {
      alert(
        'Sebagian unit yang dipilih sudah tidak tersedia. Silakan refresh halaman.'
      )
      return
    }

    for (let index = 0; index < replacementUnits.length; index++) {
      const unit = replacementUnits[index]

      if (
        unit.vehicle_type.trim().toLowerCase() !==
        request.requested_vehicle_type.trim().toLowerCase()
      ) {
        alert(
          `Jenis kendaraan Unit Pengganti ${
            index + 1
          } harus ${request.requested_vehicle_type}.`
        )
        return
      }

      if (!unit.plate_number.trim()) {
        alert(`Plat nomor Unit Pengganti ${index + 1} wajib diisi.`)
        return
      }

      if (!unit.driver_name.trim()) {
        alert(`Nama driver Unit Pengganti ${index + 1} wajib diisi.`)
        return
      }

      if (!unit.driver_phone.trim()) {
        alert(`No. HP driver Unit Pengganti ${index + 1} wajib diisi.`)
        return
      }

      if (unit.source === 'vendor' && !unit.vendor_name.trim()) {
        alert(`Nama vendor Unit Pengganti ${index + 1} wajib diisi.`)
        return
      }
    }

    if (
      selectedTrucks.some(
        (truck) =>
          truck.vehicle_type.trim().toLowerCase() ===
          request.requested_vehicle_type!.trim().toLowerCase()
      )
    ) {
      alert(
        'Jenis kendaraan baru sama dengan jenis kendaraan pada salah satu unit yang dipilih.'
      )
      return
    }

    const confirmed = window.confirm(
      `Ganti ${requestedQuantity} unit menjadi ${request.requested_vehicle_type}?\n\nUnit lama akan Cancelled dan unit pengganti akan dibuat dengan status Waiting HSE.`
    )

    if (!confirmed) return

    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('Session login tidak ditemukan.')
        return
      }

      const { error } = await supabase.rpc(
        'approve_change_vehicle_request',
        {
          p_request_id: request.id,
          p_selected_truck_ids: selectedTruckIds,
          p_replacement_units: replacementUnits.map((unit) => ({
            vehicle_type: unit.vehicle_type.trim(),
            source: unit.source,
            vendor_name:
              unit.source === 'vendor' ? unit.vendor_name.trim() : null,
            no_buntut: unit.no_buntut.trim() || null,
            plate_number: unit.plate_number.trim(),
            driver_name: unit.driver_name.trim(),
            driver_phone: unit.driver_phone.trim(),
          })),
        }
      )

      if (error) {
        console.error('APPROVE CHANGE VEHICLE ERROR:', error)
        alert(error.message)
        return
      }

      for (const truck of selectedTrucks) {
        await logUnitHistory({
          truckId: truck.id,
          orderId,
          action: 'change_vehicle',
          fieldName: 'vehicle_type',
          oldValue: truck.vehicle_type,
          newValue: request.requested_vehicle_type,
          reason: request.reason,
          changedBy: user.id,
        })
      }

      const { data: trucksAfter, error: trucksAfterError } = await supabase
        .from('order_trucks')
        .select('id, status, vehicle_type, plate_number, driver_name')
        .eq('order_id', orderId)
        .eq('status', 'waiting_hse')
        .eq('vehicle_type', request.requested_vehicle_type)

      if (!trucksAfterError) {
        for (const truck of trucksAfter || []) {
          await logUnitHistory({
            truckId: truck.id,
            orderId,
            action: 'change_vehicle',
            fieldName: 'vehicle_type',
            oldValue: null,
            newValue: truck.vehicle_type,
            reason: request.reason,
            changedBy: user.id,
          })
        }
      }

      await logOrderHistory({
        orderId,
        action: 'change_vehicle',
        fieldName: 'vehicle_type',
        oldValue: selectedTrucks.map((truck) => truck.vehicle_type).join(', '),
        newValue: replacementUnits.map((unit) => unit.vehicle_type).join(', '),
        reason: request.reason,
        changedBy: user.id,
      })

      const { error: activityError } = await supabase
        .from('activity_logs')
        .insert({
          order_id: orderId,
          user_id: user.id,
          action: 'approve_change_vehicle',
          old_value: JSON.stringify(
            selectedTrucks.map((truck) => ({
              id: truck.id,
              vehicle_type: truck.vehicle_type,
              plate_number: truck.plate_number,
              driver_name: truck.driver_name,
            }))
          ),
          new_value: JSON.stringify(
            replacementUnits.map((unit) => ({
              vehicle_type: unit.vehicle_type,
              source: unit.source,
              vendor_name: unit.source === 'vendor' ? unit.vendor_name : null,
              no_buntut: unit.no_buntut,
              plate_number: unit.plate_number,
              driver_name: unit.driver_name,
              driver_phone: unit.driver_phone,
            }))
          ),
        })

      if (activityError) {
        console.error('CHANGE VEHICLE ACTIVITY LOG ERROR:', activityError)
      }

      alert(
        `${requestedQuantity} unit berhasil diganti menjadi ${request.requested_vehicle_type}.\n\nUnit lama: Cancelled\nUnit baru: Waiting HSE`
      )

      setSelectedTruckIds([])
      setReplacementUnits([])

      router.refresh()
    } catch (error) {
      console.error('CHANGE VEHICLE ERROR:', error)
      alert('Terjadi kesalahan saat mengganti jenis unit.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelOrder() {
    if (loading) return

    const confirmed = window.confirm(
      'Yakin order ini dibatalkan? Semua unit yang masih aktif akan ditandai cancelled.'
    )

    if (!confirmed) return

    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('Session login tidak ditemukan.')
        return
      }

      const { data: trucksBefore, error: trucksError } = await supabase
        .from('order_trucks')
        .select('id, status')
        .eq('order_id', orderId)
        .not('status', 'in', '(cancelled,departed,finished)')

      if (trucksError) {
        console.error('GET ACTIVE TRUCKS ERROR:', trucksError)
        alert(trucksError.message)
        return
      }

      const { data: orderBefore, error: orderBeforeError } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single()

      if (orderBeforeError) {
        alert(orderBeforeError.message)
        return
      }

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          cancel_reason: request.reason,
          cancelled_by: user.id,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('status', orderBefore.status)

      if (orderError) {
        alert(orderError.message)
        return
      }

      if (trucksBefore?.length) {
        const { error: truckError } = await supabase
          .from('order_trucks')
          .update({
            status: 'cancelled',
            cancelled_by: user.id,
            cancelled_at: new Date().toISOString(),
            cancel_reason: request.reason,
          })
          .eq('order_id', orderId)
          .not('status', 'in', '(cancelled,departed,finished)')

        if (truckError) {
          console.error('CANCEL TRUCKS ERROR:', truckError)
          alert(truckError.message)
          return
        }
      }

      await logOrderHistory({
        orderId,
        action: 'cancel_order',
        fieldName: 'status',
        oldValue: orderBefore.status,
        newValue: 'cancelled',
        reason: request.reason,
        changedBy: user.id,
      })

      for (const truck of trucksBefore || []) {
        await logUnitHistory({
          truckId: truck.id,
          orderId,
          action: 'cancel_order',
          fieldName: 'status',
          oldValue: truck.status,
          newValue: 'cancelled',
          reason: request.reason,
          changedBy: user.id,
        })
      }

      const { error: requestError } = await supabase
        .from('order_change_requests')
        .update({ status: 'approved' })
        .eq('id', request.id)

      if (requestError) {
        alert(requestError.message)
        return
      }

      const { error: activityError } = await supabase
        .from('activity_logs')
        .insert({
          order_id: orderId,
          user_id: user.id,
          action: 'approve_cancel_order',
          old_value: orderBefore.status,
          new_value: 'cancelled',
        })

      if (activityError) {
        console.error('ACTIVITY CANCEL LOG ERROR:', activityError)
      }

      alert('Order berhasil dibatalkan.')

      router.refresh()
    } catch (error) {
      console.error('CANCEL ORDER ERROR:', error)
      alert('Terjadi kesalahan saat membatalkan order.')
    } finally {
      setLoading(false)
    }
  }

  async function handleApproveValueChange() {
    if (loading) return

    const valueChangeTypes = [
      'change_trip',
      'change_pk',
      'change_rft',
      'change_customer',
      'change_instruction',
      'change_note',
    ]

    if (!valueChangeTypes.includes(request.change_type)) {
      alert('Jenis perubahan ini tidak didukung.')
      return
    }

    if (!request.requested_value?.trim()) {
      alert('Nilai perubahan belum diisi.')
      return
    }

    const confirmed = window.confirm(
      `Setujui perubahan ${
        changeTypeLabels[request.change_type] || request.change_type
      }?`
    )

    if (!confirmed) return

    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('Session login tidak ditemukan.')
        return
      }

      const fieldMap: Record<string, string> = {
        change_trip: 'trip',
        change_pk: 'pk_number',
        change_rft: 'rft_tr_job',
        change_customer: 'customer',
        change_instruction: 'instruction',
        change_note: 'notes',
      }

      const fieldName = fieldMap[request.change_type]

      if (!fieldName) {
        alert('Field perubahan tidak ditemukan.')
        return
      }

      const { data: orderBefore, error: orderBeforeError } = await supabase
        .from('orders')
        .select(`
          trip,
          pk_number,
          rft_tr_job,
          customer,
          instruction,
          notes
        `)
        .eq('id', orderId)
        .single()

      if (orderBeforeError || !orderBefore) {
        alert(orderBeforeError?.message || 'Data order tidak ditemukan.')
        return
      }

      const oldValue =
        (orderBefore as Record<string, string | null>)[fieldName] || ''

      const newValue = request.requested_value.trim()

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          [fieldName]: newValue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)

      if (updateError) {
        alert(updateError.message)
        return
      }

      const { error: requestError } = await supabase
        .from('order_change_requests')
        .update({ status: 'approved' })
        .eq('id', request.id)

      if (requestError) {
        alert(requestError.message)
        return
      }

      await logOrderHistory({
        orderId,
        action: request.change_type,
        fieldName,
        oldValue,
        newValue,
        reason: request.reason,
        changedBy: user.id,
      })

      const { error: activityError } = await supabase
        .from('activity_logs')
        .insert({
          order_id: orderId,
          user_id: user.id,
          action: 'approve_change_request',
          old_value: oldValue,
          new_value: JSON.stringify({
            change_type: request.change_type,
            field_name: fieldName,
            value: newValue,
          }),
        })

      if (activityError) {
        console.error('VALUE CHANGE ACTIVITY LOG ERROR:', activityError)
      }

      alert('Perubahan order berhasil disetujui dan diterapkan.')

      router.refresh()
    } catch (error) {
      console.error('APPROVE VALUE CHANGE ERROR:', error)
      alert('Terjadi kesalahan saat menerapkan perubahan order.')
    } finally {
      setLoading(false)
    }
  }

  async function handleReject() {
    if (loading) return

    const confirmed = window.confirm('Tolak permintaan perubahan ini?')

    if (!confirmed) return

    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('Session login tidak ditemukan.')
        return
      }

      const { error } = await supabase
        .from('order_change_requests')
        .update({ status: 'rejected' })
        .eq('id', request.id)

      if (error) {
        alert(error.message)
        return
      }

      await supabase.from('activity_logs').insert({
        order_id: orderId,
        user_id: user.id,
        action: 'reject_change_request',
        old_value: `Request ${request.change_type}`,
        new_value: 'Rejected',
      })

      alert('Permintaan perubahan ditolak.')

      router.refresh()
    } catch (error) {
      console.error('REJECT CHANGE ERROR:', error)
      alert('Terjadi kesalahan saat menolak request.')
    } finally {
      setLoading(false)
    }
  }

  const changeTypeLabel =
    changeTypeLabels[request.change_type] || request.change_type

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
      {/* HEADER */}
      <div className="border-b border-amber-100 bg-amber-50/60 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-gray-900">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            Permintaan Perubahan
          </h2>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Menunggu Operational
          </span>
        </div>

        <p className="mt-1 text-sm text-amber-800/80">
          Marketing mengajukan perubahan pada order ini.
        </p>
      </div>

      {/* CONTENT */}
      <div className="p-6">
        <div className="mb-5 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Jenis Perubahan
          </p>

          <p className="mt-1.5 font-bold text-gray-900">{changeTypeLabel}</p>

          {request.requested_quantity !== null && (
            <p className="mt-2 text-sm text-gray-700">
              Jumlah yang diminta:{' '}
              <span className="font-bold text-gray-900">
                {request.requested_quantity} Unit
              </span>
            </p>
          )}

          {[
            'change_trip',
            'change_pk',
            'change_rft',
            'change_customer',
            'change_instruction',
            'change_note',
          ].includes(request.change_type) &&
            request.requested_value && (
              <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">
                  Nilai Baru
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm font-bold text-blue-900">
                  {request.requested_value}
                </p>
              </div>
            )}

          {request.change_type === 'change_vehicle' &&
            request.requested_vehicle_type && (
              <p className="mt-2 text-sm text-gray-700">
                Kendaraan baru:{' '}
                <span className="font-bold text-[#01236A]">
                  {request.requested_vehicle_type}
                </span>
              </p>
            )}

          <p className="mt-2 text-sm text-gray-600">
            Alasan: {request.reason || '-'}
          </p>
        </div>

        {/* INFO TANPA DETAIL TRUCK */}
        {!hasTruckDetails &&
          ['reduce_unit', 'add_unit', 'change_vehicle'].includes(
            request.change_type
          ) && (
            <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                <div>
                  <p className="font-bold text-blue-900">
                    Detail Unit Belum Diisi
                  </p>
                  <p className="mt-1 text-sm text-blue-700">
                    Operational belum mengisi detail kendaraan. Perubahan
                    tetap bisa disetujui sekarang. Sistem hanya akan
                    mengubah jumlah dan kebutuhan unit.
                  </p>
                  <p className="mt-2 text-xs font-semibold text-blue-800">
                    Setelah itu Operational tinggal mengisi detail
                    kendaraan sesuai jumlah terbaru.
                  </p>
                </div>
              </div>
            </div>
          )}

        {/* REDUCE UNIT */}
        {request.change_type === 'reduce_unit' && (
          <div>
            {hasTruckDetails ? (
              <>
                <div className="mb-3">
                  <p className="font-bold text-gray-900">
                    Pilih Unit yang Tidak Jadi Jalan
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Operational menentukan unit mana yang dikurangi
                    berdasarkan antrean dan kondisi unit.
                  </p>
                </div>

                <div className="space-y-3">
                  {selectableTrucks.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Tidak ada unit yang dapat dipilih.
                    </div>
                  ) : (
                    selectableTrucks.map((truck, index) => {
                      const selected = selectedTruckIds.includes(truck.id)

                      return (
                        <button
                          key={truck.id}
                          type="button"
                          disabled={loading}
                          onClick={() => toggleTruck(truck.id)}
                          className={`w-full rounded-xl border p-4 text-left transition ${
                            selected
                              ? 'border-[#01236A]/40 bg-[#01236A]/5 ring-1 ring-inset ring-[#01236A]/20'
                              : 'border-gray-200 bg-white hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                selected
                                  ? 'border-[#01236A] bg-[#01236A] text-white'
                                  : 'border-gray-300'
                              }`}
                            >
                              {selected && <Check className="h-3.5 w-3.5" />}
                            </div>

                            <div className="flex-1">
                              <div className="font-bold text-gray-900">
                                Unit {index + 1} — {truck.vehicle_type}
                              </div>
                              <div className="mt-1 text-sm text-gray-500">
                                {truck.plate_number || '-'}
                                {' · '}
                                {truck.driver_name || '-'}
                              </div>
                              <div className="mt-1 text-xs text-gray-400">
                                Status: {truck.status}
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>

                <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                  Dipilih:{' '}
                  <span className="font-bold text-gray-900">
                    {selectedTruckIds.length}
                  </span>
                  {' / '}
                  <span className="font-bold text-gray-900">
                    {requestedQuantity}
                  </span>
                  {' Unit'}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                Tidak ada detail truck yang perlu dipilih. Pengurangan akan
                langsung diterapkan ke jumlah kebutuhan order.
              </div>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleReject}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Tolak
              </button>

              <button
                type="button"
                onClick={handleApproveReduce}
                disabled={
                  loading ||
                  (hasTruckDetails &&
                    selectedTruckIds.length !== requestedQuantity)
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#01236A] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#01236A]/85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {loading
                  ? 'Memproses...'
                  : hasTruckDetails
                  ? 'Setujui & Terapkan'
                  : 'Setujui Pengurangan'}
              </button>
            </div>
          </div>
        )}

        {/* CHANGE VEHICLE */}
        {request.change_type === 'change_vehicle' && (
          <div className="mt-5">
            <div className="mb-4">
              <p className="font-bold text-gray-900">Ganti Jenis Unit</p>
              <p className="mt-1 text-xs text-gray-500">
                Permintaan mengganti {requestedQuantity} unit menjadi{' '}
                <strong>{request.requested_vehicle_type || '-'}</strong>.
              </p>
            </div>

            <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-500">
                Kendaraan Baru
              </div>
              <div className="mt-1 text-lg font-bold text-blue-900">
                {request.requested_vehicle_type || '-'}
              </div>
              <div className="mt-1 text-xs text-blue-700">
                Jumlah penggantian: {requestedQuantity} unit
              </div>
            </div>

            {hasTruckDetails ? (
              <>
                <div className="mb-3">
                  <p className="font-bold text-gray-900">
                    Pilih Unit yang Akan Diganti
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Pilih tepat {requestedQuantity} unit.
                  </p>
                </div>

                <div className="space-y-3">
                  {selectableTrucks.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Tidak ada unit yang dapat diganti.
                    </div>
                  ) : (
                    selectableTrucks.map((truck, index) => {
                      const selected = selectedTruckIds.includes(truck.id)

                      return (
                        <button
                          key={truck.id}
                          type="button"
                          disabled={loading}
                          onClick={() => toggleTruck(truck.id)}
                          className={`w-full rounded-xl border p-4 text-left transition ${
                            selected
                              ? 'border-[#01236A]/40 bg-[#01236A]/5 ring-1 ring-inset ring-[#01236A]/20'
                              : 'border-gray-200 bg-white hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                selected
                                  ? 'border-[#01236A] bg-[#01236A] text-white'
                                  : 'border-gray-300'
                              }`}
                            >
                              {selected && <Check className="h-3.5 w-3.5" />}
                            </div>

                            <div className="flex-1">
                              <div className="font-bold text-gray-900">
                                Unit {index + 1} — {truck.vehicle_type}
                              </div>
                              <div className="mt-1 text-sm text-gray-500">
                                {truck.plate_number || '-'}
                                {' · '}
                                {truck.driver_name || '-'}
                              </div>
                              <div className="mt-1 text-xs text-gray-400">
                                Status: {truck.status}
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>

                <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                  Dipilih:{' '}
                  <span className="font-bold text-gray-900">
                    {selectedTruckIds.length}
                  </span>
                  {' / '}
                  <span className="font-bold text-gray-900">
                    {requestedQuantity}
                  </span>{' '}
                  Unit
                </div>

                {selectedTruckIds.length > 0 && (
                  <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/40 p-5">
                    <p className="font-bold text-gray-900">
                      Detail Unit Pengganti
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Isi detail unit pengganti.
                    </p>

                    <div className="mt-4 space-y-5">
                      {replacementUnits.map((unit, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-blue-100 bg-white p-5"
                        >
                          <p className="mb-4 font-bold text-gray-900">
                            Unit Pengganti {index + 1}
                          </p>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                                Jenis Kendaraan
                              </label>
                              <select
                                value={unit.vehicle_type}
                                onChange={(event) =>
                                  updateReplacementUnit(
                                    index,
                                    'vehicle_type',
                                    event.target.value
                                  )
                                }
                                disabled={loading}
                                className={inputClass}
                              >
                                <option value="">Pilih kendaraan</option>
                                <option value="Trailer">Trailer</option>
                                <option value="Lowbed">Lowbed</option>
                                <option value="Tronton">Tronton</option>
                                <option value="Fuso">Fuso</option>
                                <option value="Colt Diesel">
                                  Colt Diesel
                                </option>
                                <option value="Double Cabin">
                                  Double Cabin
                                </option>
                                <option value="Pickup">Pickup</option>
                                <option value="Dolly">Dolly</option>
                              </select>
                            </div>

                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                                Sumber Unit
                              </label>
                              <select
                                value={unit.source}
                                onChange={(event) =>
                                  updateReplacementUnit(
                                    index,
                                    'source',
                                    event.target.value as
                                      | 'internal'
                                      | 'vendor'
                                  )
                                }
                                disabled={loading}
                                className={inputClass}
                              >
                                <option value="internal">Internal</option>
                                <option value="vendor">Vendor</option>
                              </select>
                            </div>

                            {unit.source === 'vendor' && (
                              <div className="md:col-span-2">
                                <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                                  Nama Vendor
                                </label>
                                <input
                                  type="text"
                                  value={unit.vendor_name}
                                  onChange={(event) =>
                                    updateReplacementUnit(
                                      index,
                                      'vendor_name',
                                      event.target.value
                                    )
                                  }
                                  disabled={loading}
                                  placeholder="Contoh: PT ABC Transport"
                                  className={inputClass}
                                />
                              </div>
                            )}

                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                                Plat Nomor
                              </label>
                              <input
                                type="text"
                                value={unit.plate_number}
                                onChange={(event) =>
                                  updateReplacementUnit(
                                    index,
                                    'plate_number',
                                    event.target.value
                                  )
                                }
                                disabled={loading}
                                placeholder="Contoh: B 1234 XYZ"
                                className={inputClass}
                              />
                            </div>

                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                                No. Buntut
                              </label>
                              <input
                                type="text"
                                value={unit.no_buntut}
                                onChange={(event) =>
                                  updateReplacementUnit(
                                    index,
                                    'no_buntut',
                                    event.target.value
                                  )
                                }
                                disabled={loading}
                                placeholder="Contoh: 40-22"
                                className={inputClass}
                              />
                            </div>

                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                                Nama Driver
                              </label>
                              <input
                                type="text"
                                value={unit.driver_name}
                                onChange={(event) =>
                                  updateReplacementUnit(
                                    index,
                                    'driver_name',
                                    event.target.value
                                  )
                                }
                                disabled={loading}
                                placeholder="Nama driver"
                                className={inputClass}
                              />
                            </div>

                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                                No. HP Driver
                              </label>
                              <input
                                type="text"
                                value={unit.driver_phone}
                                onChange={(event) =>
                                  updateReplacementUnit(
                                    index,
                                    'driver_phone',
                                    event.target.value
                                  )
                                }
                                disabled={loading}
                                placeholder="08xxxxxxxxxx"
                                className={inputClass}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-bold text-amber-900">
                    Perhatian
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    Unit lama yang dipilih akan berstatus Cancelled. Unit
                    pengganti baru masuk Waiting HSE.
                  </p>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                Tidak ada detail truck yang perlu dipilih. Sistem hanya
                akan mengubah kebutuhan kendaraan dari{' '}
                <strong>{request.requested_vehicle_type || '-'}</strong>.
              </div>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleReject}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Tolak
              </button>

              <button
                type="button"
                onClick={handleApproveChangeVehicle}
                disabled={
                  loading ||
                  (hasTruckDetails &&
                    (selectedTruckIds.length !== requestedQuantity ||
                      replacementUnits.length !== requestedQuantity)) ||
                  !request.requested_vehicle_type
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#01236A] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#01236A]/85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {loading
                  ? 'Memproses...'
                  : hasTruckDetails
                  ? 'Setujui & Ganti Unit'
                  : 'Setujui Perubahan'}
              </button>
            </div>
          </div>
        )}

        {/* ADD UNIT */}
        {request.change_type === 'add_unit' && (
          <div className="mt-5">
            {hasTruckDetails ? (
              <>
                <div className="mb-4">
                  <p className="font-bold text-gray-900">Detail Unit Baru</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Isi detail unit yang akan ditambahkan.
                  </p>
                </div>

                <div className="space-y-5">
                  {newUnits.map((unit, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-gray-100 bg-gray-50/60 p-5"
                    >
                      <p className="mb-4 font-bold text-gray-900">
                        Unit {index + 1}
                      </p>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                            Jenis Kendaraan
                          </label>
                          <select
                            value={unit.vehicle_type}
                            onChange={(event) =>
                              updateNewUnit(
                                index,
                                'vehicle_type',
                                event.target.value
                              )
                            }
                            disabled={loading}
                            className={inputClass}
                          >
                            <option value="">Pilih kendaraan</option>
                            <option value="Trailer">Trailer</option>
                            <option value="Lowbed">Lowbed</option>
                            <option value="Tronton">Tronton</option>
                            <option value="Fuso">Fuso</option>
                            <option value="Colt Diesel">Colt Diesel</option>
                            <option value="Double Cabin">
                              Double Cabin
                            </option>
                            <option value="Pickup">Pickup</option>
                            <option value="Dolly">Dolly</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                            Sumber Unit
                          </label>
                          <select
                            value={unit.source}
                            onChange={(event) =>
                              updateNewUnit(
                                index,
                                'source',
                                event.target.value as 'internal' | 'vendor'
                              )
                            }
                            disabled={loading}
                            className={inputClass}
                          >
                            <option value="internal">Internal</option>
                            <option value="vendor">Vendor</option>
                          </select>
                        </div>

                        {unit.source === 'vendor' && (
                          <div className="md:col-span-2">
                            <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                              Nama Vendor
                            </label>
                            <input
                              type="text"
                              value={unit.vendor_name}
                              onChange={(event) =>
                                updateNewUnit(
                                  index,
                                  'vendor_name',
                                  event.target.value
                                )
                              }
                              disabled={loading}
                              placeholder="Contoh: PT ABC Transport"
                              className={inputClass}
                            />
                          </div>
                        )}

                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                            Plat Nomor
                          </label>
                          <input
                            type="text"
                            value={unit.plate_number}
                            onChange={(event) =>
                              updateNewUnit(
                                index,
                                'plate_number',
                                event.target.value
                              )
                            }
                            disabled={loading}
                            placeholder="Contoh: B 1234 XYZ"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                            No. Buntut
                          </label>
                          <input
                            type="text"
                            value={unit.no_buntut}
                            onChange={(event) =>
                              updateNewUnit(
                                index,
                                'no_buntut',
                                event.target.value
                              )
                            }
                            disabled={loading}
                            placeholder="Contoh: 40-22"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                            Nama Driver
                          </label>
                          <input
                            type="text"
                            value={unit.driver_name}
                            onChange={(event) =>
                              updateNewUnit(
                                index,
                                'driver_name',
                                event.target.value
                              )
                            }
                            disabled={loading}
                            placeholder="Nama driver"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                            No. HP Driver
                          </label>
                          <input
                            type="text"
                            value={unit.driver_phone}
                            onChange={(event) =>
                              updateNewUnit(
                                index,
                                'driver_phone',
                                event.target.value
                              )
                            }
                            disabled={loading}
                            placeholder="08xxxxxxxxxx"
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <p className="font-bold text-blue-900">
                  Tambah Kebutuhan Unit
                </p>
                <p className="mt-1 text-sm text-blue-700">
                  Detail kendaraan belum ada, jadi tidak perlu mengisi
                  plat, driver, atau data kendaraan. Sistem hanya
                  menambah jumlah kebutuhan unit.
                </p>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleReject}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Tolak
              </button>

              <button
                type="button"
                onClick={handleApproveAdd}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#01236A] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#01236A]/85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {loading
                  ? 'Memproses...'
                  : hasTruckDetails
                  ? 'Setujui & Tambahkan'
                  : 'Setujui & Tambah Kebutuhan'}
              </button>
            </div>
          </div>
        )}

        {/* VALUE CHANGE */}
        {[
          'change_trip',
          'change_pk',
          'change_rft',
          'change_customer',
          'change_instruction',
          'change_note',
        ].includes(request.change_type) && (
          <div className="mt-5">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
              <p className="font-bold text-blue-900">Terapkan Perubahan</p>
              <p className="mt-1 text-sm text-blue-700">
                Nilai baru akan diterapkan langsung ke order setelah
                disetujui.
              </p>

              <div className="mt-4 rounded-lg border border-blue-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Nilai Baru
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm font-bold text-gray-900">
                  {request.requested_value || '-'}
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleReject}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Tolak
              </button>

              <button
                type="button"
                onClick={handleApproveValueChange}
                disabled={loading || !request.requested_value?.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#01236A] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#01236A]/85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {loading ? 'Menerapkan...' : 'Setujui & Terapkan'}
              </button>
            </div>
          </div>
        )}

        {/* CANCEL ORDER */}
        {request.change_type === 'cancel_order' && (
          <div className="mt-5">
            <div className="rounded-xl border border-red-200 bg-red-50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div>
                  <p className="font-bold text-red-900">
                    Pembatalan Order
                  </p>
                  <p className="mt-1 text-sm text-red-700">
                    Marketing mengajukan pembatalan order ini. Jika
                    disetujui, order akan berstatus{' '}
                    <strong>Cancelled</strong> dan seluruh unit yang
                    masih aktif akan dibatalkan.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleReject}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Tolak
              </button>

              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {loading ? 'Membatalkan...' : 'Setujui Pembatalan'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}