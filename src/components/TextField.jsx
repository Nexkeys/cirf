import { Eye, EyeOff } from 'lucide-react'
import { useId, useState } from 'react'
import styles from './TextField.module.css'

// A labelled input with an icon on the left, like every field in the auth designs.
// Password fields get the show/hide eye on the right. `error` appears under the input,
// and `children` renders inside the field (EstatePicker puts its suggestions there).
export function TextField({ label, icon: Icon, error, type = 'text', className = '', children, ...inputProps }) {
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'
  const errorId = `${id}-error`

  return (
    <div className={`${styles.field} ${className}`}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={`${styles.control} ${error ? styles.invalid : ''}`}>
        {Icon && <Icon className={styles.icon} size={18} strokeWidth={1.75} aria-hidden="true" />}
        <input
          id={id}
          type={isPassword && revealed ? 'text' : type}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            className={styles.reveal}
            onClick={() => setRevealed((shown) => !shown)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
          >
            {revealed ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
          </button>
        )}
      </div>
      {children}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}
