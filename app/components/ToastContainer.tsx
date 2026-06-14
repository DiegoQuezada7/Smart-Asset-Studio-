"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { useToast, ToastType } from '../contexts/ToastContext';

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <Check size={16} />,
  error: <AlertCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  info: <Info size={16} />,
};

const colorMap: Record<ToastType, string> = {
  success: '#6b8f5e',
  error: '#c2483a',
  warning: '#d4a76a',
  info: '#c9603c',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 99999,
      display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none', maxWidth: 360,
    }}>
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, x: 80, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{
              pointerEvents: 'auto',
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px',
              borderRadius: 10,
              background: 'var(--bg-elevated)',
              border: `1px solid ${colorMap[toast.type]}44`,
              boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px ${colorMap[toast.type]}22`,
              backdropFilter: 'blur(12px)',
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: `${colorMap[toast.type]}22`,
              color: colorMap[toast.type],
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {iconMap[toast.type]}
            </div>
            <span style={{
              flex: 1, fontSize: '0.85rem', color: 'var(--text-main)',
              lineHeight: 1.4,
            }}>
              {toast.message}
            </span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'transparent', border: 'none',
                color: 'var(--text-dim)', cursor: 'pointer',
                padding: 2, display: 'flex', flexShrink: 0,
              }}
              aria-label="Cerrar notificación"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
