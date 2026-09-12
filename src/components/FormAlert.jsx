import { CircleAlert } from 'lucide-react'
import styles from './FormAlert.module.css'

// A problem with the whole form, such as a wrong password, shown above the submit button.
export function FormAlert({ children }) {
  if (!children) return null
  return (
    <div className={styles.alert} role="alert">
      <CircleAlert size={18} strokeWidth={2} aria-hidden="true" />
      <p>{children}</p>
    </div>
  )
}
