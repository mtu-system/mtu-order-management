import type { ChangeEvent } from 'react'

// Ambil isi input dalam huruf besar, tapi posisi kursor dijaga supaya
// tidak loncat ke ujung saat mengedit di tengah teks.
export function upperValue(event: ChangeEvent<HTMLInputElement>): string {
  const input = event.target
  const start = input.selectionStart
  const end = input.selectionEnd

  requestAnimationFrame(() => {
    if (start !== null && end !== null) {
      input.setSelectionRange(start, end)
    }
  })

  return input.value.toUpperCase()
}