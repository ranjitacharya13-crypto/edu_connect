import { createContext, useCallback, useContext, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState('System ready')

  const showToast = useCallback((message) => {
    setToast(message)
    setTimeout(() => setToast('System ready'), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast, showToast }}>
      {children}
      <div className="fixed bottom-20 sm:bottom-24 right-3 sm:right-5 z-50 max-w-xs rounded-2xl border border-white/70 bg-white/75 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-bold text-slate-700 shadow-glass backdrop-blur-2xl md:bottom-8">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
          <span className="truncate">{toast}</span>
        </div>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
