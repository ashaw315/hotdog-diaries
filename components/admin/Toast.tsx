'use client'

import { useState, createContext, useContext, ReactNode } from 'react'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextType {
  showToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  toasts: Toast[]
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000
    }
    
    setToasts(prev => [...prev, newToast])

    // Auto remove toast after duration
    if (newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, newToast.duration)
    }
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  return (
    <ToastContext.Provider value={{ showToast, removeToast, toasts }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <>
      <style jsx>{`
        .toast-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 400px;
        }
        
        .toast {
          background: white;
          border-radius: 8px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          border-left: 4px solid;
          padding: 16px;
          animation: slideIn 0.3s ease-out;
          transition: all 0.2s ease;
        }
        
        .toast:hover {
          transform: translateX(-2px);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }
        
        .toast-success {
          border-left-color: #10b981;
        }
        
        .toast-error {
          border-left-color: #ef4444;
        }
        
        .toast-warning {
          border-left-color: #f59e0b;
        }
        
        .toast-info {
          border-left-color: #3b82f6;
        }
        
        .toast-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 8px;
        }
        
        .toast-content {
          flex: 1;
          min-width: 0;
        }
        
        .toast-icon {
          font-size: 18px;
          flex-shrink: 0;
        }
        
        .toast-title {
          font-weight: 600;
          color: #111827;
          margin: 0 0 4px 0;
          font-size: 14px;
          line-height: 1.4;
        }
        
        .toast-message {
          color: #6b7280;
          font-size: 13px;
          line-height: 1.4;
          margin: 0;
        }
        
        .toast-close {
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 0;
          font-size: 18px;
          line-height: 1;
          flex-shrink: 0;
          transition: color 0.2s;
        }
        
        .toast-close:hover {
          color: #6b7280;
        }
        
        .toast-action {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #f3f4f6;
        }
        
        .toast-action-btn {
          background: none;
          border: none;
          color: #3b82f6;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          padding: 0;
          text-decoration: underline;
          transition: color 0.2s;
        }
        
        .toast-action-btn:hover {
          color: #1d4ed8;
        }
        
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @media (max-width: 640px) {
          .toast-container {
            left: 20px;
            right: 20px;
            max-width: none;
          }
          
          .toast {
            margin: 0;
          }
        }
      `}</style>
      
      <div className="toast-container">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </div>
    </>
  )
}

interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const getIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success': return '✅'
      case 'error': return '❌'
      case 'warning': return '⚠️'
      case 'info': return 'ℹ️'
      default: return '📝'
    }
  }

  return (
    <div className={`toast toast-${toast.type}`}>
      <div className="toast-header">
        <div className="toast-content">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span className="toast-icon">{getIcon(toast.type)}</span>
            <div>
              <h4 className="toast-title">{toast.title}</h4>
              {toast.message && (
                <p className="toast-message">{toast.message}</p>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => onRemove(toast.id)}
          className="toast-close"
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
      
      {toast.action && (
        <div className="toast-action">
          <button
            onClick={() => {
              toast.action!.onClick()
              onRemove(toast.id)
            }}
            className="toast-action-btn"
          >
            {toast.action.label}
          </button>
        </div>
      )}
    </div>
  )
}

// Enhanced useToast hook with convenience methods
export const useToastActions = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToastActions must be used within a ToastProvider')
  }
  
  return {
    success: (title: string, message?: string) => {
      context.showToast({ type: 'success', title, message })
    },
    
    error: (title: string, message?: string, action?: Toast['action']) => {
      context.showToast({ type: 'error', title, message, action, duration: 0 }) // Don't auto-dismiss errors
    },
    
    warning: (title: string, message?: string) => {
      context.showToast({ type: 'warning', title, message })
    },
    
    info: (title: string, message?: string) => {
      context.showToast({ type: 'info', title, message })
    }
  }
}