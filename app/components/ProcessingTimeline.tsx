"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Sparkles, ArrowRight } from 'lucide-react';
import { ProcessedResult } from '../hooks/useImageProcessor';

interface ProcessingTimelineProps {
  results: Record<string, ProcessedResult>;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProcessingTimeline({ results, isOpen, onClose }: ProcessingTimelineProps) {
  const entries = Object.entries(results).reverse();

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed': return <Sparkles size={14} style={{ color: 'var(--success)' }} />;
      case 'error': return <span style={{ color: 'var(--danger)', fontWeight: 700 }}>!</span>;
      default: return <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', animation: 'pulse 1.5s ease infinite' }} />;
    }
  };

  const getTimeAgo = (timestamp?: number) => {
    if (!timestamp) return '';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Ahora';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-active)',
              borderRadius: 20,
              padding: '2rem',
              maxWidth: 600,
              width: '90%',
              maxHeight: '80vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '1.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 600 }}>
                  Timeline de Procesamiento
                </h3>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent', border: 'none', color: 'var(--text-dim)',
                  cursor: 'pointer', padding: 4, display: 'flex',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 0,
            }}>
              {entries.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem' }}>
                  No hay imágenes procesadas aún.
                </p>
              ) : (
                entries.map(([id, res], index) => (
                  <motion.div
                    key={id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    style={{
                      display: 'flex', gap: '1rem',
                      padding: '0.75rem 0',
                      borderBottom: index < entries.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    {/* Visual column */}
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 4, minWidth: 48,
                    }}>
                      <img
                        src={res.processedUrl || res.originalUrl}
                        alt=""
                        style={{
                          width: 48, height: 48, borderRadius: 8,
                          objectFit: 'cover', border: '1px solid var(--border-subtle)',
                        }}
                      />
                      {res.initialProcessedUrl && res.status === 'completed' && (
                        <ArrowRight size={12} style={{ color: 'var(--primary)', opacity: 0.5 }} />
                      )}
                    </div>

                    {/* Info column */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600, fontSize: '0.85rem',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {res.fileName}
                      </div>
                      <div style={{
                        display: 'flex', gap: '0.75rem', marginTop: 4,
                        fontSize: '0.75rem', color: 'var(--text-dim)',
                      }}>
                        <span>
                          {res.originalWidth && res.originalHeight
                            ? `${res.originalWidth}×${res.originalHeight}px`
                            : '?'}
                        </span>
                        {res.originalSize && (
                          <span>{(res.originalSize / 1024 / 1024).toFixed(2)} MB</span>
                        )}
                      </div>
                      <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                        {res.status === 'completed' && (
                          <span style={{
                            fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4,
                            background: 'rgba(107,143,94,0.12)', color: 'var(--success)',
                          }}>
                            Fondo eliminado
                          </span>
                        )}
                        {res.status === 'error' && (
                          <span style={{
                            fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4,
                            background: 'var(--danger-dim)', color: 'var(--danger)',
                          }}>
                            Error
                          </span>
                        )}
                        {res.status === 'processing' && (
                          <span style={{
                            fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4,
                            background: 'var(--primary-dim)', color: 'var(--primary)',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', animation: 'pulse 1.5s ease infinite' }} />
                            Procesando
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status indicator */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 4 }}>
                      {getStepIcon(res.status)}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
