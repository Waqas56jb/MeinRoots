import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'

const ToastContext = createContext(null)

let nextId = 1

/**
 * Confirmation for actions that change something.
 *
 * Approving a candidate or resolving a flag has no visible side effect on the
 * page beyond a badge changing, so without this the admin cannot tell whether
 * the click registered.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message, tone = 'good') => {
      const id = nextId
      nextId += 1
      setToasts((current) => [...current, { id, message, tone }])
      setTimeout(() => dismiss(id), tone === 'bad' ? 6000 : 3500)
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      toast: push,
      success: (message) => push(message, 'good'),
      error: (message) => push(message, 'bad'),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* aria-live so the confirmation is announced, not only shown */}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            <Icon name={t.tone === 'bad' ? 'alert' : 'check'} size={16} />
            <span>{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Close">
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
