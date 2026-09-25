'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PlusCircle } from 'lucide-react'

type CustomerSuggestion = {
  id: string
  name: string
}

type CustomerAutocompleteProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export default function CustomerAutocomplete({
  value,
  onChange,
  disabled,
}: CustomerAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!value.trim()) {
      setSuggestions([])
      return
    }

    const supabase = createClient()

    const timeout = setTimeout(async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .eq('is_active', true)
        .ilike('name', `%${value.trim()}%`)
        .order('name')
        .limit(8)

      if (error) {
        console.error('SEARCH CUSTOMER ERROR:', error)
        return
      }

      setSuggestions(data || [])
    }, 250)

    return () => clearTimeout(timeout)
  }, [value])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () =>
      document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(name: string) {
    onChange(name)
    setOpen(false)
    setHighlightedIndex(-1)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((current) =>
        current < suggestions.length - 1 ? current + 1 : 0
      )
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((current) =>
        current > 0 ? current - 1 : suggestions.length - 1
      )
    } else if (event.key === 'Enter') {
      if (highlightedIndex >= 0) {
        event.preventDefault()
        handleSelect(suggestions[highlightedIndex].name)
      }
       } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const isExactMatch = suggestions.some(
    (item) => item.name.toLowerCase() === value.trim().toLowerCase()
  )

  const showNewIndicator =
    value.trim().length > 1 && !isExactMatch && suggestions.length === 0

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
          setHighlightedIndex(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Contoh: Halliburton"
        autoComplete="off"
        disabled={disabled}
        className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
      />

       {open && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {suggestions.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(item.name)}
              className={`block w-full px-3.5 py-2.5 text-left text-sm transition ${
                index === highlightedIndex
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}

      {open && showNewIndicator && (
        <div className="absolute z-20 mt-1.5 w-full rounded-lg border border-amber-100 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <PlusCircle className="h-3.5 w-3.5" />
            Customer baru — akan ditambahkan ke master
          </span>
        </div>
      )}
    </div>
  )
}