import { ChevronDown } from 'lucide-react'
import { useId } from 'react'
import styles from './FormField.module.css'

// A labelled field on the dashboard forms: white box, optional icon on the left, an
// optional unit on the right (₦, hh), and a hint or error underneath. `as` picks the
// control: "input" (default), "select" or "textarea". Other props go to the control.
export function FormField({
  label,
  required = false,
  optional = false,
  hint,
  error,
  counter,
  icon: Icon,
  suffix,
  as: Control = 'input',
  className = '',
  children,
  ...controlProps
}) {
  const id = useId()
  const describedBy = error || hint ? `${id}-note` : undefined

  return (
    <div className={`${styles.field} ${className}`}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            {' '}
            *
          </span>
        )}
        {optional && <span className={styles.optional}> (optional)</span>}
      </label>
      <div
        className={`${styles.control} ${Control === 'textarea' ? styles.multiline : ''} ${error ? styles.invalid : ''} ${
          Icon ? styles.withIcon : ''
        }`}
      >
        {Icon && <Icon className={styles.icon} size={19} strokeWidth={1.7} aria-hidden="true" />}
        <Control
          id={id}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          required={required}
          {...controlProps}
        >
          {children}
        </Control>
        {Control === 'select' && <ChevronDown className={styles.chevron} size={18} aria-hidden="true" />}
        {suffix && <span className={styles.suffix}>{suffix}</span>}
      </div>
      {(error || hint || counter) && (
        <div className={styles.below}>
          <p id={describedBy} className={error ? styles.error : styles.hint}>
            {error || hint}
          </p>
          {counter && <span className={styles.counter}>{counter}</span>}
        </div>
      )}
    </div>
  )
}
