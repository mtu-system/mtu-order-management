const WIB_MS = 7 * 3600e3

export type PeriodMode = 'month' | 'year' | 'all'

export type Period = {
  mode: PeriodMode
  key: string
  label: string
  startIso: string
  endIso: string
  startDate: string
  endDate: string
  prevKey: string | null
  nextKey: string | null
  monthKey: string
  yearKey: string
}

function monthKey(year: number, month0: number) {
  const date = new Date(Date.UTC(year, month0, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

// Parameter ?bulan= bisa berisi:
//   2026-11  -> satu bulan
//   2026     -> satu tahun
//   semua    -> seluruh data
// Tanpa parameter: bulan ini (WIB).
// allowFuture: untuk Booking Report, yang memang melihat tanggal ke depan.
export function resolvePeriod(param: string | undefined, allowFuture = false): Period {
  const nowWib = new Date(Date.now() + WIB_MS)
  const currentYear = nowWib.getUTCFullYear()
  const currentMonth0 = nowWib.getUTCMonth()
  const currentMonthKey = monthKey(currentYear, currentMonth0)

  if (param === 'semua') {
    return {
      mode: 'all',
      key: 'semua',
      label: 'Semua Data',
      startIso: '1970-01-01T00:00:00.000Z',
      endIso: '9999-01-01T00:00:00.000Z',
      startDate: '1970-01-01',
      endDate: '9999-01-01',
      prevKey: null,
      nextKey: null,
      monthKey: currentMonthKey,
      yearKey: String(currentYear),
    }
  }

  const yearMatch = /^(\d{4})$/.exec(param || '')

  if (yearMatch && (allowFuture || Number(yearMatch[1]) <= currentYear)) {
    const year = Number(yearMatch[1])

    return {
      mode: 'year',
      key: String(year),
      label: `Tahun ${year}`,
      startIso: new Date(Date.UTC(year, 0, 1) - WIB_MS).toISOString(),
      endIso: new Date(Date.UTC(year + 1, 0, 1) - WIB_MS).toISOString(),
      startDate: `${year}-01-01`,
      endDate: `${year + 1}-01-01`,
      prevKey: String(year - 1),
      nextKey: !allowFuture && year >= currentYear ? null : String(year + 1),
      monthKey: year === currentYear ? currentMonthKey : `${year}-12`,
      yearKey: String(year),
    }
  }

  let year = currentYear
  let month0 = currentMonth0
  const monthMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(param || '')

  if (monthMatch) {
    const wantedYear = Number(monthMatch[1])
    const wantedMonth0 = Number(monthMatch[2]) - 1

    if (allowFuture || monthKey(wantedYear, wantedMonth0) <= currentMonthKey) {
      year = wantedYear
      month0 = wantedMonth0
    }
  }

  const key = monthKey(year, month0)
  const nextKey = monthKey(year, month0 + 1)

  return {
    mode: 'month',
    key,
    label: new Intl.DateTimeFormat('id-ID', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month0, 1))),
    startIso: new Date(Date.UTC(year, month0, 1) - WIB_MS).toISOString(),
    endIso: new Date(Date.UTC(year, month0 + 1, 1) - WIB_MS).toISOString(),
    startDate: `${key}-01`,
    endDate: `${nextKey}-01`,
    prevKey: monthKey(year, month0 - 1),
    nextKey: !allowFuture && key >= currentMonthKey ? null : nextKey,
    monthKey: key,
    yearKey: String(year),
  }
}