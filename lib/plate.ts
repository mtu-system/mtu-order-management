// "B 1234 XYZ", "b-1234-xyz" dan "B1234XYZ" dianggap sama.
export function normalizePlate(value: string | null | undefined) {
  return (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}