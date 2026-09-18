'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type NoBuntutSuggestion = {
  id: string
  code: string
}

type NoBuntutAutocompleteProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export default function NoBuntutAutocomplete({
  value,
  onChange,
  disabled,
}: NoBuntutAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<NoBuntutSuggestion[]>([])
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
        .from('no_buntut')
        .select('id, code')
        .eq('is_active', true)
        .ilike('code', `%${value.trim()}%`)
        .order('code')
        .limit(8)

      if (error) {
        console.error('SEARCH NO BUNTUT ERROR:', error)
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

  function handleSelect(code: string) {
    onChange(code)
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
        handleSelect(suggestions[highlightedIndex].code)
      }
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

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
        placeholder="Contoh: 40-33"
        autoComplete="off"
        disabled={disabled}
        className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
      />

      {open && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {suggestions.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(item.code)}
              className={`block w-full px-3.5 py-2.5 text-left text-sm transition ${
                index === highlightedIndex
                  ? 'bg-[#2563EB]/5 text-[#2563EB]'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.code}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}