import { Check } from 'lucide-react'
import styles from './Stepper.module.css'

// The numbered steps across the top of Create Campaign. Finished steps show a tick and
// can be clicked to go back to them.
export function Stepper({ steps, current, onSelect }) {
  return (
    <ol className={styles.stepper} aria-label="Campaign setup steps">
      {steps.map((label, index) => {
        const number = index + 1
        const state = number < current ? 'done' : number === current ? 'current' : 'next'
        return (
          <li key={label} className={`${styles.step} ${styles[state]}`} aria-current={state === 'current' ? 'step' : undefined}>
            <button type="button" disabled={state !== 'done'} onClick={() => onSelect(number)}>
              <span className={styles.marker}>{state === 'done' ? <Check size={16} strokeWidth={3} /> : number}</span>
              <span className={styles.label}>{label}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
