import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { ToastContext } from './ToastContext.js'
import styles from './Toast.module.css'

const SHOW_MS = 4000

// Short messages that confirm something worked ("Contribution verified"), stacked in a
// corner and gone after a few seconds. Screens call useToast() from ToastContext.js.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)

  const dismiss = useCallback((id) => setToasts((shown) => shown.filter((toast) => toast.id !== id)), [])

  const show = useCallback(
    (message, tone) => {
      const id = nextId.current++
      setToasts((shown) => [...shown.slice(-2), { id, message, tone }])
      setTimeout(() => dismiss(id), SHOW_MS)
    },
    [dismiss],
  )

  const toast = useMemo(
    () => ({ success: (message) => show(message, 'success'), error: (message) => show(message, 'error') }),
    [show],
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={styles.stack} role="status" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`${styles.toast} ${styles[item.tone]}`}>
            {item.tone === 'error' ? <CircleAlert size={19} aria-hidden="true" /> : <CircleCheck size={19} aria-hidden="true" />}
            <span>{item.message}</span>
            <button type="button" onClick={() => dismiss(item.id)} aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
