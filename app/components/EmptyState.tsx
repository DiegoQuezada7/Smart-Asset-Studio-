"use client";

import { Upload, ImageIcon, Palette, Settings, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  view: 'upload' | 'results' | 'studio' | 'settings';
  onAction?: () => void;
}

const config = {
  upload: {
    icon: Upload,
    title: 'Arrastra y suelta imágenes aquí',
    subtitle: 'o haz clic para buscar archivos',
    action: 'Seleccionar Archivos',
    hint: 'Compatible con PNG, JPG, WebP',
  },
  results: {
    icon: Sparkles,
    title: 'Aún no hay resultados',
    subtitle: 'Procesa tus imágenes para ver los resultados aquí',
    action: 'Ir a Mesa de Trabajo',
    hint: 'Los resultados aparecerán automáticamente al procesar',
  },
  studio: {
    icon: Palette,
    title: 'Lienzo vacío',
    subtitle: 'Añade activos procesados o importa imágenes para comenzar',
    action: 'Importar Imagen',
    hint: 'Arrastra imágenes directamente al lienzo',
  },
  settings: {
    icon: Settings,
    title: 'Configuración',
    subtitle: 'Personaliza tu flujo de trabajo de exportación',
    action: undefined,
    hint: 'Los cambios se guardan automáticamente',
  },
};

export default function EmptyState({ view, onAction }: EmptyStateProps) {
  const c = config[view];
  const Icon = c.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 400,
        padding: '2rem',
      }}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        textAlign: 'center',
        maxWidth: 360,
      }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: 'var(--primary-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '0.5rem',
        }}>
          <Icon size={32} style={{ color: 'var(--primary)' }} />
        </div>
        <h3 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.2rem',
          fontWeight: 600,
          color: 'var(--text-main)',
          margin: 0,
        }}>
          {c.title}
        </h3>
        <p style={{
          fontSize: '0.9rem',
          color: 'var(--text-muted)',
          lineHeight: 1.5,
          margin: 0,
        }}>
          {c.subtitle}
        </p>
        <span style={{
          fontSize: '0.8rem',
          color: 'var(--text-dim)',
        }}>
          {c.hint}
        </span>
        {onAction && c.action && (
          <button
            onClick={onAction}
            className="btn-primary"
            style={{ marginTop: '0.5rem' }}
          >
            {c.action}
          </button>
        )}
      </div>
    </motion.div>
  );
}
