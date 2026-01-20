"use client";

import { useState, useRef, useEffect, MouseEvent, TouchEvent } from 'react';
import styles from './CompareSlider.module.css';

interface CompareSliderProps {
  before: string;
  after: string;
}

export default function CompareSlider({ before, after }: CompareSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMove = (clientX: number) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percentage = (x / rect.width) * 100;
      setSliderPosition(percentage);
    }
  };

  const onMouseDown = () => {
    isDragging.current = true;
  };

  const onMouseUp = () => {
    isDragging.current = false;
  };

  const onMouseMove = (e: MouseEvent) => {
    if (isDragging.current) {
      handleMove(e.clientX);
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  // Add global event listeners to handle dragging outside the component
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isDragging.current = false;
    };
    const handleGlobalMouseMove = (e: globalThis.MouseEvent) => {
        if (isDragging.current) {
            handleMove(e.clientX);
        }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('mousemove', handleGlobalMouseMove);

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, []);

  return (
    <div 
      className={styles.container} 
      ref={containerRef}
      onMouseDown={onMouseDown}
      onTouchMove={onTouchMove}
    >
      {/* After Image (Background/Processed) */}
      <img src={after} alt="After" className={`${styles.image} ${styles.imageAfter}`} />
      
      {/* Before Image (Foreground/Original) - Clipped */}
      <div 
         style={{ 
             position: 'absolute', 
             top: 0, 
             left: 0, 
             width: '100%', 
             height: '100%', 
             clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
             zIndex: 2
         }}
      >
          <img src={before} alt="Before" className={`${styles.image} ${styles.imageBefore}`} />
      </div>

      {/* Slider Handle */}
      <div 
        className={styles.sliderHandle} 
        style={{ left: `${sliderPosition}%` }} 
      />

      <span className={`${styles.label} ${styles.labelBefore}`} style={{ opacity: sliderPosition > 10 ? 1 : 0 }}>Original</span>
      <span className={`${styles.label} ${styles.labelAfter}`} style={{ opacity: sliderPosition < 90 ? 1 : 0 }}>Procesado</span>
    </div>
  );
}
