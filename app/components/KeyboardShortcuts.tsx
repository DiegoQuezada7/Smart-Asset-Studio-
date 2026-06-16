"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string; desc: string }[];
}

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

const groups: ShortcutGroup[] = [
  {
    title: 'Navegación',
    shortcuts: [
      { keys: '1', desc: 'Dashboard' },
      { keys: '2', desc: 'Mesa de Trabajo' },
      { keys: '3', desc: 'Resultados' },
      { keys: '4', desc: 'Design Studio' },
      { keys: '5', desc: 'Ajustes' },
    ],
  },
  {
    title: 'Acciones',
    shortcuts: [
      { keys: 'E', desc: 'Exportar todo' },
      { keys: 'Supr', desc: 'Eliminar selección (en resultados)' },
      { keys: 'Ctrl + K', desc: 'Paleta de comandos' },
    ],
  },
  {
    title: 'Mask Editor',
    shortcuts: [
      { keys: 'Ctrl + Z', desc: 'Deshacer' },
      { keys: 'Ctrl + Y', desc: 'Rehacer' },
      { keys: 'Espacio', desc: 'Modo mover (temporal)' },
    ],
  },
  {
    title: 'Design Studio',
    shortcuts: [
      { keys: 'Ctrl + Z', desc: 'Deshacer' },
      { keys: 'Ctrl + Y', desc: 'Rehacer' },
      { keys: 'Supr', desc: 'Eliminar objeto' },
      { keys: 'Flechas', desc: 'Mover 1px (10px con Shift)' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { keys: '?', desc: 'Mostrar esta ayuda' },
      { keys: 'Esc', desc: 'Cerrar modal / lightbox' },
    ],
  },
];

export default function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: 'var(--overlay)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Atajos de teclado"
            style={{
              width: '100%',
              maxWidth: 480,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-active)',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Keyboard size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>
                  Atajos de Teclado
                </h3>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                }}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              padding: '12px 20px 20px',
              maxHeight: 400,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}>
              {groups.map((group) => (
                <div key={group.title}>
                  <h4 style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-dim)',
                    margin: 0,
                    marginBottom: 6,
                  }}>
                    {group.title}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {group.shortcuts.map((s) => (
                      <div
                        key={s.keys + s.desc}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '4px 0',
                        }}
                      >
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {s.desc}
                        </span>
                        <kbd style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          background: 'var(--bg-card)',
                          borderRadius: 4,
                          color: 'var(--text-main)',
                          border: '1px solid var(--border-subtle)',
                          fontFamily: 'inherit',
                          whiteSpace: 'nowrap',
                        }}>
                          {s.keys}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
