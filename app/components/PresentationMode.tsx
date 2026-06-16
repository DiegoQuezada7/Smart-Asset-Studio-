"use client";

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Download } from 'lucide-react';

interface PresentationImage {
  id: string;
  url: string;
  label: string;
}

interface PresentationModeProps {
  images: PresentationImage[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export default function PresentationMode({ images, currentIndex, isOpen, onClose, onIndexChange }: PresentationModeProps) {
  const current = images[currentIndex];

  const goNext = useCallback(() => {
    if (currentIndex < images.length - 1) onIndexChange(currentIndex + 1);
  }, [currentIndex, images.length, onIndexChange]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) onIndexChange(currentIndex - 1);
  }, [currentIndex, onIndexChange]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, goNext, goPrev]);

  return (
    <AnimatePresence>
      {isOpen && current && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 5000,
            background: '#000',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <motion.img
            key={current.id}
            src={current.url}
            alt={current.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '92vw',
              maxHeight: '88vh',
              objectFit: 'contain',
              borderRadius: 4,
              cursor: 'default',
            }}
          />

          <div style={{
            position: 'fixed', top: '1.5rem', left: '50%', transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.85rem',
            textAlign: 'center',
            pointerEvents: 'none',
            fontFamily: 'var(--font-body)',
          }}>
            {current.label}
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: '0.75rem', alignItems: 'center',
              background: 'rgba(0,0,0,0.6)',
              padding: '0.5rem 1rem',
              borderRadius: 50,
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              style={{
                background: 'transparent', border: 'none', color: 'white',
                cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                opacity: currentIndex === 0 ? 0.3 : 0.8,
                padding: 8, borderRadius: '50%', display: 'flex',
                transition: 'all 0.15s',
              }}
              aria-label="Anterior"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <span style={{
              color: 'white', fontSize: '0.85rem',
              fontVariantNumeric: 'tabular-nums', minWidth: 60, textAlign: 'center',
              opacity: 0.7,
            }}>
              {currentIndex + 1} / {images.length}
            </span>
            <button
              onClick={goNext}
              disabled={currentIndex === images.length - 1}
              style={{
                background: 'transparent', border: 'none', color: 'white',
                cursor: currentIndex === images.length - 1 ? 'not-allowed' : 'pointer',
                opacity: currentIndex === images.length - 1 ? 0.3 : 0.8,
                padding: 8, borderRadius: '50%', display: 'flex',
                transition: 'all 0.15s',
              }}
              aria-label="Siguiente"
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />
            <button
              onClick={() => {
                const a = document.createElement('a');
                a.href = current.url;
                a.download = current.label;
                a.click();
              }}
              style={{
                background: 'transparent', border: 'none', color: 'white',
                cursor: 'pointer', opacity: 0.8, padding: 8, borderRadius: '50%',
                display: 'flex', transition: 'all 0.15s',
              }}
              aria-label="Descargar"
            >
              <Download size={18} aria-hidden="true" />
            </button>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />
            <button
              onClick={onClose}
              style={{
                background: 'transparent', border: 'none', color: 'white',
                cursor: 'pointer', opacity: 0.8, padding: 8, borderRadius: '50%',
                display: 'flex', transition: 'all 0.15s',
              }}
              aria-label="Cerrar presentación"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
