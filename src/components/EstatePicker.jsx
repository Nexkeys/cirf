import { MapPin } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { api } from '../lib/api.js'
import styles from './EstatePicker.module.css'
import { TextField } from './TextField.jsx'

// "Community / Estate" for residents. They type the start of their estate's name and pick
// it from the suggestions (GET /api/public/estates). Picking calls onSelect(estate);
// typing again clears the choice with onSelect(null). onQueryChange reports the raw text,
// so the form can tell "left empty" apart from "typed but didn't pick".
export function EstatePicker({ selected, onSelect, onQueryChange, error, disabled }) {
  const [query, setQuery] = useState(selected?.name ?? '')
  const [results, setResults] = useState({ for: '', estates: [] })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const listId = useId()

  const text = query.trim()
  const searching = !selected && text.length >= 2

  // Wait until typing pauses before searching, and ignore answers to older searches.
  useEffect(() => {
    if (!searching) return
    let stale = false
    const timer = setTimeout(async () => {
      try {
        const { estates } = await api(`/public/estates?q=${encodeURIComponent(text)}`, { signedIn: false })
        if (!stale) setResults({ for: text, estates })
      } catch {
        if (!stale) setResults({ for: text, estates: [] })
      }
      if (!stale) setActive(-1)
    }, 250)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [searching, text])

  const answered = results.for === text
  const estates = answered ? results.estates : []
  const showList = open && searching

  function choose(estate) {
    onSelect(estate)
    setQuery(estate.name)
    onQueryChange?.(estate.name)
    setOpen(false)
  }

  function handleKeyDown(event) {
    if (!showList || estates.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (index + 1) % estates.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => (index <= 0 ? estates.length - 1 : index - 1))
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault()
      choose(estates[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <TextField
      label="Community / Estate"
      icon={MapPin}
      placeholder="e.g. Maple Estate, Alagbado"
      value={query}
      onChange={(event) => {
        setQuery(event.target.value)
        onQueryChange?.(event.target.value)
        setOpen(true)
        if (selected) onSelect(null)
      }}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={handleKeyDown}
      role="combobox"
      aria-expanded={showList}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
      autoComplete="off"
      error={error}
      disabled={disabled}
    >
      {showList && (
        <ul id={listId} role="listbox" className={styles.list}>
          {estates.map((estate, index) => (
            <li
              key={estate.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={styles.option}
              // mousedown, not click: it fires before the input's blur closes the list
              onMouseDown={(event) => {
                event.preventDefault()
                choose(estate)
              }}
            >
              <span className={styles.name}>{estate.name}</span>
              {estate.address && <span className={styles.address}>{estate.address}</span>}
            </li>
          ))}
          {!answered && <li className={styles.note}>Searching…</li>}
          {answered && estates.length === 0 && (
            <li className={styles.note}>
              No estate by that name on CIRF yet. Check the spelling, or ask your community lead to invite your email.
            </li>
          )}
        </ul>
      )}
    </TextField>
  )
}
