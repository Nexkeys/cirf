import { ArrowRight, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router'
import styles from './Button.module.css'

// Buttons from the designs:
//   primary  dark green, on the cream screens (Sign In, Create Account, ...)
//   outline  light with a border (Continue with Google)
//   glass    translucent green on the Welcome photo
//   bright   vivid green on the Home photo
// Pass `to` for a link that looks like a button, `arrow` for the trailing arrow, and
// `busy` while a request is running.
export function Button({ variant = 'primary', arrow = false, busy = false, to, className = '', children, ...props }) {
  const classes = `${styles.button} ${styles[variant]} ${className}`
  const content = (
    <>
      {busy && <LoaderCircle className={styles.spinner} size={18} aria-hidden="true" />}
      <span>{children}</span>
      {arrow && !busy && <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {content}
      </Link>
    )
  }
  return (
    <button type="button" className={classes} aria-busy={busy || undefined} {...props} disabled={busy || props.disabled}>
      {content}
    </button>
  )
}
