import { createContext, useContext } from 'react'

export const ToastContext = createContext({ success: () => {}, error: () => {} })

// const toast = useToast(); toast.success('Saved'); toast.error('Could not save')
export const useToast = () => useContext(ToastContext)
