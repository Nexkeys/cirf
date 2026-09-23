import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import styles from './Modal.module.css'

// A dialog over the page, built on <dialog> so the browser handles focus, Escape and
// the backdrop. Rendered only while open.
export function Modal({ title, description, onClose, children, wide = false }) {
  const dialog = useRef(null)

  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])

  return (
    <dialog
      ref={dialog}
      className={`${styles.modal} ${wide ? styles.wide : ''}`}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      aria-labelledby="modal-title"
    >
      <header className={styles.header}>
        <div>
          <h2 id="modal-title" className={styles.title}>
            {title}
          </h2>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </header>
      <div className={styles.body}>{children}</div>
    </dialog>
  )
}
