import styles from './RoleTabs.module.css'

const ROLES = [
  { value: 'resident', label: 'Resident' },
  { value: 'admin', label: 'Community Lead' },
]

// The Resident / Community Lead switch on Sign In and Create Account. It behaves like a
// pair of radio buttons, so the arrow keys move between the two.
export function RoleTabs({ value, onChange, disabled = false }) {
  function handleKeyDown(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next = ROLES.find((role) => role.value !== value)
    onChange(next.value)
    event.currentTarget.querySelector(`[data-role="${next.value}"]`)?.focus()
  }

  return (
    <div className={styles.tabs} role="radiogroup" aria-label="Account type" onKeyDown={handleKeyDown}>
      {ROLES.map((role) => {
        const selected = role.value === value
        return (
          <button
            key={role.value}
            type="button"
            role="radio"
            data-role={role.value}
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(role.value)}
            disabled={disabled}
          >
            {role.label}
          </button>
        )
      })}
    </div>
  )
}
