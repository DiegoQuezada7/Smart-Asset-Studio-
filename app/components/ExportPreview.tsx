"use client";

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Check, FileImage, FileType } from 'lucide-react';

interface ExportItem {
  id: string;
  fileName: string;
  url: string;
  size: number;
}

interface ExportPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  items: ExportItem[];
  format: string;
  quality: number;
  onExport: (selectedIds: string[]) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function estimateSize(bytes: number, format: string, quality: number): number {
  if (format === 'png') return bytes * 0.9;
  if (format === 'webp') return bytes * (0.3 + (1 - quality) * 0.4);
  return bytes * (0.15 + (1 - quality) * 0.3);
}

export default function ExportPreview({ isOpen, onClose, items, format, quality, onExport }: ExportPreviewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(items.map(i => i.id)));

  useEffect(() => {
    if (isOpen) {
      setSelected(new Set(items.map(i => i.id)));
    }
  }, [isOpen, items]);

  const toggleAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(i => i.id)));
    }
  };

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalEstimated = useMemo(() => {
    return items
      .filter(i => selected.has(i.id))
      .reduce((sum, i) => sum + estimateSize(i.size, format, quality / 100), 0);
  }, [items, selected, format, quality]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Vista previa de exportación"
            style={{
              width: '100%',
              maxWidth: 560,
              maxHeight: '80vh',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-active)',
              borderRadius: 16,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
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
                <Download size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                  Exportar {items.length} archivo{items.length !== 1 ? 's' : ''}
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
              padding: '8px 12px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.8rem',
              color: 'var(--text-dim)',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selected.size === items.length && items.length > 0}
                  onChange={toggleAll}
                  style={{ accentColor: 'var(--primary)' }}
                />
                {selected.size} de {items.length} seleccionados
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => {
                    const allIds = new Set(items.map(i => i.id));
                    const inverted = new Set(items.map(i => i.id).filter(id => !selected.has(id)));
                    setSelected(inverted);
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '0.75rem',
                  }}
                >
                  Invertir
                </button>
                <span>
                  ~{formatBytes(totalEstimated)} en total ({format.toUpperCase()}, {quality}%)
                </span>
              </div>
            </div>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              {items.map((item) => {
                const isSelected = selected.has(item.id);
                const estimated = estimateSize(item.size, format, quality / 100);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: isSelected ? 'var(--primary-dim)' : 'transparent',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--primary)' : 'var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(item.id)}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 6,
                      overflow: 'hidden',
                      flexShrink: 0,
                      background: 'var(--bg-card)',
                    }}>
                      <img
                        src={item.url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        color: 'var(--text-main)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        margin: 0,
                      }}>
                        {item.fileName}
                      </p>
                      <p style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-dim)',
                        margin: 0,
                        marginTop: 2,
                      }}>
                        Original: {formatBytes(item.size)} → Estimado: ~{formatBytes(Math.round(estimated))}
                      </p>
                    </div>
                    <FileImage size={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>

            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
            }}>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  padding: '8px 16px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '0.85rem',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => onExport(Array.from(selected))}
                disabled={selected.size === 0}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: '0.85rem' }}
              >
                <Download size={16} />
                Exportar {selected.size} archivo{selected.size !== 1 ? 's' : ''}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
