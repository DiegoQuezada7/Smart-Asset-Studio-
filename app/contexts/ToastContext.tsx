"use client";

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, Loader2, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'progress';

export interface ToastAction {
  label: string;
  action: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  exiting?: boolean;
  progress?: number;
  duration?: number;
  action?: ToastAction;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => string;
  addToastWithAction: (type: ToastType, message: string, action: ToastAction, duration?: number) => string;
  addProgressToast: (message: string) => string;
  updateProgressToast: (id: string, message: string, progress: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle size={18} />,
  error: <XCircle size={18} />,
  info: <Info size={18} />,
  warning: <AlertTriangle size={18} />,
  progress: <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 200);
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback((type: ToastType, message: string, duration = 4000): string => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, message }]);
    const timer = setTimeout(() => removeToast(id), duration);
    timersRef.current.set(id, timer);
    return id;
  }, [removeToast]);

  const addToastWithAction = useCallback((type: ToastType, message: string, action: ToastAction, duration = 6000): string => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, message, action }]);
    const timer = setTimeout(() => removeToast(id), duration);
    timersRef.current.set(id, timer);
    return id;
  }, [removeToast]);

  const addProgressToast = useCallback((message: string): string => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type: 'progress', message, progress: 0 }]);
    return id;
  }, []);

  const updateProgressToast = useCallback((id: string, message: string, progress: number) => {
    setToasts(prev => prev.map(t =>
      t.id === id ? { ...t, message, progress } : t
    ));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, addToastWithAction, addProgressToast, updateProgressToast, removeToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type} ${toast.exiting ? 'exiting' : ''}`}
            style={{ position: 'relative', overflow: 'hidden' }}
          >
            <span className="toast-icon">{TOAST_ICONS[toast.type]}</span>
            <span className="toast-message">{toast.message}</span>
            {toast.type === 'progress' && toast.progress !== undefined && (
              <span style={{ fontSize: '0.75rem', opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(toast.progress)}%
              </span>
            )}
            {toast.action && (
              <button
                onClick={() => { toast.action!.action(); removeToast(toast.id); }}
                style={{
                  background: 'var(--primary-dim)',
                  border: '1px solid var(--primary)',
                  color: 'var(--primary)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  flexShrink: 0,
                  touchAction: 'manipulation',
                  minHeight: 32,
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button className="toast-close" onClick={() => removeToast(toast.id)} aria-label="Cerrar">
              <X size={14} />
            </button>
            {toast.type === 'progress' && toast.progress !== undefined && (
              <div
                className="toast-progress-bar"
                style={{
                  animation: 'none',
                  width: `${toast.progress}%`,
                  background: 'rgba(255,255,255,0.25)',
                  transition: 'width 0.3s ease',
                }}
              />
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
