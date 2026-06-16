"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, ImageIcon, Palette, Settings,
  Download, Sparkles, Search, Keyboard, ArrowRight,
  Scissors, Layers, CornerDownLeft
} from 'lucide-react';

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

export default function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? commands.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

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
            display: 'flex', alignItems: 'flex-start',
            justifyContent: 'center', paddingTop: '12vh',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.12 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Paleta de comandos"
            style={{
              width: '100%',
              maxWidth: 520,
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
              gap: 12,
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <Search size={18} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Buscar comandos..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-main)',
                  fontSize: '1rem',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <kbd style={{
                fontSize: 10,
                padding: '2px 6px',
                background: 'var(--bg-card)',
                borderRadius: 4,
                color: 'var(--text-dim)',
                border: '1px solid var(--border-subtle)',
                fontFamily: 'inherit',
              }}>
                <Keyboard size={12} style={{display:'inline', verticalAlign:'middle'}} /> K
              </kbd>
            </div>

            <div style={{
              maxHeight: 320,
              overflowY: 'auto',
              padding: '6px',
            }}>
              {filtered.length === 0 ? (
                <div style={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: 'var(--text-dim)',
                  fontSize: '0.9rem',
                }}>
                  Sin resultados para &ldquo;{query}&rdquo;
                </div>
              ) : (
                filtered.map((cmd, i) => (
                  <button
                    key={cmd.id}
                    onClick={() => { cmd.action(); onClose(); }}
                    onMouseEnter={() => setSelectedIndex(i)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      background: i === selectedIndex ? 'var(--primary-dim)' : 'transparent',
                      border: 'none',
                      borderRadius: 8,
                      color: i === selectedIndex ? 'var(--primary)' : 'var(--text-main)',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      transition: 'all 0.1s',
                    }}
                  >
                    <span style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: i === selectedIndex ? 'var(--primary)' : 'var(--bg-card)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      color: i === selectedIndex ? 'var(--primary-text)' : 'var(--text-muted)',
                    }}>
                      {cmd.icon}
                    </span>
                    <span style={{ flex: 1 }}>{cmd.label}</span>
                    {cmd.shortcut && (
                      <kbd style={{
                        fontSize: 10,
                        padding: '2px 5px',
                        background: 'var(--bg-card)',
                        borderRadius: 4,
                        color: 'var(--text-dim)',
                        border: '1px solid var(--border-subtle)',
                        fontFamily: 'inherit',
                      }}>
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                ))
              )}
            </div>

            <div style={{
              padding: '8px 12px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              gap: 16,
              fontSize: 11,
              color: 'var(--text-dim)',
            }}>
              <span style={{display:'flex', alignItems:'center', gap:4}}>
                <ArrowRight size={12} /> <CornerDownLeft size={12} /> navegar
              </span>
              <span style={{display:'flex', alignItems:'center', gap:4}}>
                <kbd style={{fontSize:10, padding:'1px 4px', background:'var(--bg-card)', borderRadius:3, fontFamily:'inherit'}}>Esc</kbd> cerrar
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
