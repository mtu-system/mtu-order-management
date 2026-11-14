const PAGE_SIZE = 1000
const MAX_PAGES = 60

// Supabase hanya mengembalikan maksimal 1000 baris per permintaan.
// Fungsi ini mengambil halaman demi halaman sampai habis, jadi laporan
// tidak terpotong diam-diam. Batas pengaman: 60 halaman (60.000 baris).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAll<T = any>(
  load: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
) {
  const rows: T[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await load(from, from + PAGE_SIZE - 1)

    if (error) return { rows, error, truncated: false }

    rows.push(...(data || []))

    if (!data || data.length < PAGE_SIZE) {
      return { rows, error: null, truncated: false }
    }
  }

  return { rows, error: null, truncated: true }
}