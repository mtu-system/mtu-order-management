import * as XLSX from 'xlsx'

type CellValue = string | number | null | undefined

const MIN_COL_WIDTH = 8
const MAX_COL_WIDTH = 60

export function downloadExcel(
  rows: Record<string, CellValue>[],
  sheetName: string,
  filePrefix: string
) {
  // Tambah kolom "No" di paling kiri.
  const numberedRows = rows.map((row, index) => ({
    No: index + 1,
    ...row,
  }))

  const worksheet = XLSX.utils.json_to_sheet(numberedRows)

  // Lebar kolom otomatis: ikut teks terpanjang di kolom itu (termasuk header).
  const headers = numberedRows.length
    ? Object.keys(numberedRows[0])
    : ['No']

  worksheet['!cols'] = headers.map((header) => {
    const longestCell = numberedRows.reduce((max, row) => {
      const value = (row as Record<string, CellValue>)[header]
      const length = value === null || value === undefined
        ? 0
        : String(value).length
      return Math.max(max, length)
    }, header.length)

    return {
      wch: Math.min(Math.max(longestCell + 2, MIN_COL_WIDTH), MAX_COL_WIDTH),
    }
  })

  // Filter di baris header.
  if (worksheet['!ref']) {
    worksheet['!autofilter'] = { ref: worksheet['!ref'] }
  }

  const workbook = XLSX.utils.book_new()
  // Nama sheet maksimal 31 karakter di Excel.
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31))

  const today = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `${filePrefix}-${today}.xlsx`)
}