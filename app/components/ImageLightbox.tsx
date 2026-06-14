"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, RotateCcw, Download } from 'lucide-react';

interface LightboxImage {
  id: string;
  url: string;
  label?: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function ImageLightbox({ images, initialIndex = 0, isOpen, onClose }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, [initialIndex, isOpen]);

  const goTo = useCallback((dir: number) => {
    setCurrentIndex(i => {
      const next = i + dir;
      if (next < 0) return images.length - 1;
      if (next >= images.length) return 0;
      return next;
    });
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, [images.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goTo(-1);
      if (e.key === 'ArrowRight') goTo(1);
      if (e.key === '+' || e.key === '=') setScale(s => Math.min(5, s + 0.25));
      if (e.key === '-') setScale(s => Math.max(0.25, s - 0.25));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, goTo]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setPanStart({ ...pan });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: panStart.x + (e.clientX - dragStart.x),
      y: panStart.y + (e.clientY - dragStart.y),
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(s => Math.max(0.25, Math.min(5, s * delta)));
  };

  // Touch pinch-zoom
  const touchRef = useRef<{ dist: number; scale: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchRef.current = { dist: Math.hypot(dx, dy), scale };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const ratio = newDist / touchRef.current.dist;
      setScale(Math.max(0.25, Math.min(5, touchRef.current.scale * ratio)));
    }
  };

  const handleTouchEnd = () => {
    touchRef.current = null;
  };

  const current = images[currentIndex];

  return (
    <AnimatePresence>
      {isOpen && current && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.92)',
            backdropFilter: 'blur(8px)',
            display: 'flex', flexDirection: 'column',
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top bar */}
          <div style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.5rem',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {current.label || `Imagen ${currentIndex + 1} de ${images.length}`}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setScale(s => Math.max(0.25, s - 0.25))} style={btnStyle} aria-label="Alejar">
                <ZoomOut size={18} />
              </button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', minWidth: 36, textAlign: 'center' }}>
                {Math.round(scale * 100)}%
              </span>
              <button onClick={() => setScale(s => Math.min(5, s + 0.25))} style={btnStyle} aria-label="Acercar">
                <ZoomIn size={18} />
              </button>
              <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} style={btnStyle} aria-label="Resetear vista">
                <RotateCcw size={16} />
              </button>
              <button onClick={() => {
                const a = document.createElement('a');
                a.href = current.url;
                a.download = current.label || `image-${currentIndex + 1}`;
                a.click();
              }} style={btnStyle} aria-label="Descargar">
                <Download size={18} />
              </button>
              <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', margin: '0 4px' }} />
              <button onClick={onClose} style={btnStyle} aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Image area */}
          <div
            ref={containerRef}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative',
              cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            }}
          >
            <motion.img
              key={current.id}
              src={current.url}
              alt={current.label || ''}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15 }}
              draggable={false}
              style={{
                maxWidth: '90%',
                maxHeight: '85%',
                objectFit: 'contain',
                transform: `scale(${scale}) translate(${pan.x / scale}px, ${pan.y / scale}px)`,
                transition: isDragging ? 'none' : 'transform 0.15s',
                borderRadius: 4,
              }}
            />

            {/* Navigation arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); goTo(-1); }}
                  style={{
                    position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                    ...navBtnStyle,
                  }}
                  aria-label="Anterior"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); goTo(1); }}
                  style={{
                    position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                    ...navBtnStyle,
                  }}
                  aria-label="Siguiente"
                >
                  <ChevronRight size={24} />
                </button>

                {/* Dots */}
                <div style={{
                  position: 'absolute', bottom: 20,
                  display: 'flex', gap: 6,
                }}>
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); setScale(1); setPan({x:0,y:0}); }}
                      style={{
                        width: i === currentIndex ? 20 : 6,
                        height: 6,
                        borderRadius: 3,
                        border: 'none',
                        background: i === currentIndex ? 'var(--primary)' : 'rgba(255,255,255,0.2)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      aria-label={`Ir a imagen ${i + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'var(--text-main)',
  borderRadius: 6,
  width: 34,
  height: 34,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.15s',
};

const navBtnStyle: React.CSSProperties = {
  ...btnStyle,
  width: 44,
  height: 44,
  borderRadius: 12,
  background: 'rgba(0,0,0,0.5)',
  border: '1px solid rgba(255,255,255,0.1)',
};
