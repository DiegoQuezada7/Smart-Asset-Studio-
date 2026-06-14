"use client";

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ContextMenuAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  action: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  actions: ContextMenuAction[];
}

export default function ContextMenu({ x, y, isOpen, onClose, actions }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    setTimeout(() => document.addEventListener('click', handler), 0);
    document.addEventListener('keydown', escapeHandler);
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', escapeHandler);
    };
  }, [isOpen, onClose]);

  const adjustedX = typeof window !== 'undefined' ? Math.min(x, window.innerWidth - 200) : x;
  const adjustedY = typeof window !== 'undefined' ? Math.min(y, window.innerHeight - actions.length * 40 - 16) : y;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ duration: 0.1 }}
          style={{
            position: 'fixed', left: adjustedX, top: adjustedY, zIndex: 30000,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-active)',
            borderRadius: 10,
            padding: '4px',
            minWidth: 160,
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {actions.map((item) => (
            <button
              key={item.id}
              onClick={() => { item.action(); onClose(); }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-active)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 12px',
                background: 'transparent', border: 'none',
                borderRadius: 6, cursor: 'pointer',
                color: item.danger ? 'var(--danger)' : 'var(--text-main)',
                fontFamily: 'inherit', fontSize: '0.85rem',
                transition: 'background 0.1s',
              }}
            >
              {item.icon && <span style={{ display: 'flex', flexShrink: 0 }}>{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
