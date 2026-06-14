"use client";

import { useDropzone } from "react-dropzone";
import { Upload, X, ImageIcon, Download, Loader2, Sparkles, Pencil, Trash2, Scissors, Palette, Settings, Layers, Grid3X3, List, ArrowUpDown, ZoomIn, Maximize2, Home as HomeIcon, Clock, BarChart3, Play, Monitor, Eye, Focus, Zap, RefreshCw } from "lucide-react";
import { useCallback, useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import styles from "./page.module.css";
import { useImageProcessor } from "./hooks/useImageProcessor";
import { downloadAsZip } from "./utils/downloader";
import CompareSlider from "./components/CompareSlider";
import MaskEditor from "./components/MaskEditor";
import DesignStudio from "./components/studio/DesignStudio";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { useKeyboard } from "./hooks/useKeyboard";
import { useToast } from "./contexts/ToastContext";
import EmptyState from "./components/EmptyState";
import CommandPalette from "./components/CommandPalette";
import KeyboardShortcuts from "./components/KeyboardShortcuts";
import ImageLightbox from "./components/ImageLightbox";
import ExportPreview from "./components/ExportPreview";
import ContextMenu from "./components/ContextMenu";
import PresentationMode from "./components/PresentationMode";
import ProcessingTimeline from "./components/ProcessingTimeline";

interface FileWithPreview extends File {
  preview: string;
}

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.15 }}
        style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border-active)', borderRadius: 16,
          padding: '2rem', maxWidth: 400, width: '90%', display: 'flex', flexDirection: 'column', gap: '1.5rem',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Confirmación"
      >
        <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ background: 'transparent', border: '1px solid var(--border-active)', color: 'var(--text-muted)', padding: '0.5rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '0.5rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 600 }}
          >
            Confirmar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Home() {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const { results, isProcessing, currentProcessingId, processImages, processBatch, cancelProcessing, retryAsset, clearHistory, updateResultBlob, deleteAsset, deleteMultiple, renameFile, renameBatch } = useImageProcessor();
  const [viewMode, setViewMode] = useState<'dashboard' | 'upload' | 'results' | 'settings' | 'studio'>('dashboard');
  const [showSeoMenu, setShowSeoMenu] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Gallery state
  const [galleryView, setGalleryView] = useLocalStorage<'grid' | 'list'>('gallery_view', 'grid');
  const [zoomLevel, setZoomLevel] = useLocalStorage('gallery_zoom', 50);
  const [sortMode, setSortMode] = useLocalStorage<'name' | 'date' | 'size'>('gallery_sort', 'date');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Settings State (Persistent)
  const [seoPrefix, setSeoPrefix] = useLocalStorage('seo_prefix', '');
  const [exportFormat, setExportFormat] = useLocalStorage<'png' | 'webp' | 'jpeg'>('export_format', 'png');
  const [quality, setQuality] = useLocalStorage('export_quality', 90);
  const [shouldUpscale, setShouldUpscale] = useLocalStorage('upscale_enabled', false);
  const [bgColor, setBgColor] = useLocalStorage('bg_color', '');
  const [searchQuery, setSearchQuery] = useState('');

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  // Batch resize
  const [resizeEnabled, setResizeEnabled] = useLocalStorage('resize_enabled', false);
  const [resizeWidth, setResizeWidth] = useLocalStorage('resize_width', 1000);
  const [resizeHeight, setResizeHeight] = useLocalStorage('resize_height', 1000);

  // Export presets
  const [presets, setPresets] = useLocalStorage<{ name: string; format: string; quality: number; bgColor: string; upscale: boolean }[]>('export_presets', []);
  const [showPresetInput, setShowPresetInput] = useState(false);
  const [presetName, setPresetName] = useState('');
  const toast = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) =>
      Object.assign(file, {
        preview: URL.createObjectURL(file),
      })
    );
    setFiles((prev) => [...prev, ...newFiles]);
    if (viewMode === 'results') setViewMode('upload');
  }, [viewMode]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
  });

  const removeFile = (name: string) => {
    setFiles((files) => files.filter((file) => file.name !== name));
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    processBatch(files, shouldUpscale);
    setViewMode('results');
  };

  const handleCancel = () => {
    cancelProcessing();
    toast.addToast('info', 'Procesamiento cancelado');
  };

  const completedResults = useMemo(() =>
    Object.values(results).filter(r => r.status === 'completed'),
  [results]);

  const handleExport = async () => {
    if (completedResults.length > 0) {
      setExportPreviewOpen(true);
    }
  };

  const doExport = async (selectedIds: string[]) => {
    const toExport = completedResults.filter(r => selectedIds.includes(r.id));
    if (toExport.length > 0) {
      await downloadAsZip(toExport, exportFormat, quality / 100, bgColor, resizeEnabled ? resizeWidth : undefined, resizeEnabled ? resizeHeight : undefined);
      setTotalExports(prev => prev + toExport.length);
      toast.addToast('success', `Exportación completada — ${toExport.length} archivo${toExport.length !== 1 ? 's' : ''}`);
    }
    setExportPreviewOpen(false);
  };

  const downloadIndividual = async (id: string) => {
    const asset = results[id];
    if (!asset || asset.status !== 'completed') return;
    await downloadAsZip([asset], exportFormat, quality / 100, bgColor, resizeEnabled ? resizeWidth : undefined, resizeEnabled ? resizeHeight : undefined);
    toast.addToast('success', `${asset.fileName} descargado`);
  };

  const handleRetry = async (id: string) => {
    await retryAsset(id, shouldUpscale);
  };

  const handleDeleteBatch = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    deleteMultiple(Array.from(selectedIds));
    setSelectedIds(new Set());
    toast.addToast('info', `${count} imagen${count !== 1 ? 'es' : ''} eliminada${count !== 1 ? 's' : ''}`);
  };

  const handleDeleteAsset = (id: string) => {
    const name = results[id]?.fileName || 'Imagen';
    deleteAsset(id);
    toast.addToast('info', `${name} eliminada`);
  };

  const handleReprocessBatch = async () => {
    const toReprocess = completedResults.filter(r => selectedIds.size === 0 || selectedIds.has(r.id));
    if (toReprocess.length === 0) return;
    const files = await Promise.all(
      toReprocess.map(async (r) => {
        const res = await fetch(r.originalUrl);
        const blob = await res.blob();
        return new File([blob], r.fileName, { type: blob.type });
      })
    );
    // Clear selected items to reprocess
    const idsToRemove = new Set(toReprocess.map(r => r.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      idsToRemove.forEach(id => next.delete(id));
      return next;
    });
    processBatch(files, shouldUpscale);
  };

  const hasResults = Object.keys(results).length > 0;

  const completedCount = Object.values(results).filter(r => r.status === 'completed').length;
  const totalCount = Object.keys(results).length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const sortedResults = useMemo(() => {
    let entries = Object.entries(results);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      entries = entries.filter(([, r]) => r.fileName.toLowerCase().includes(q));
    }
    switch (sortMode) {
      case 'name':
        return [...entries].sort(([, a], [, b]) => a.fileName.localeCompare(b.fileName));
      default:
        return entries;
    }
  }, [results, sortMode, searchQuery]);

  const lightboxImages = useMemo(() =>
    completedResults.map(r => ({ id: r.id, url: r.processedUrl, label: r.fileName })),
  [completedResults]);

  const exportItems = useMemo(() =>
    completedResults.map(r => ({
      id: r.id,
      fileName: r.fileName,
      url: r.processedUrl,
      size: r.originalSize || 0,
    })),
  [completedResults]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === sortedResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedResults.map(([id]) => id)));
    }
  };

  // Focus Mode (Zen)
  const [focusMode, setFocusMode] = useState(false);

  // Presentation mode
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [presentationIndex, setPresentationIndex] = useState(0);

  // Color palette extracted from images
  const [colorPalettes, setColorPalettes] = useState<Record<string, string[]>>({});

  // Timeline processing
  const [timelineOpen, setTimelineOpen] = useState(false);

  // Stats for dashboard
  const [totalExports, setTotalExports] = useLocalStorage('total_exports', 0);
  const stats = useMemo(() => {
    const completed = Object.values(results).filter(r => r.status === 'completed');
    return {
      totalProcessed: completed.length,
      totalExports,
      timeSaved: completed.length * 45,
      recentImages: completed.slice(-6).reverse(),
    };
  }, [results, totalExports]);

  // Extract color palette from an image URL
  const extractPalette = useCallback(async (imageUrl: string): Promise<string[]> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(['#c9603c', '#d4a76a', '#7a8b72']); return; }
        ctx.drawImage(img, 0, 0, 50, 50);
        const imageData = ctx.getImageData(0, 0, 50, 50).data;
        const colorCounts: Record<string, number> = {};
        for (let i = 0; i < imageData.length; i += 16) {
          const r = Math.round(imageData[i] / 32) * 32;
          const g = Math.round(imageData[i + 1] / 32) * 32;
          const b = Math.round(imageData[i + 2] / 32) * 32;
          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          colorCounts[hex] = (colorCounts[hex] || 0) + 1;
        }
        const sorted = Object.entries(colorCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([color]) => color);
        resolve(sorted);
      };
      img.onerror = () => resolve(['#c9603c', '#d4a76a', '#7a8b72']);
      img.src = imageUrl;
    });
  }, []);

  // Extract palettes for all completed results
  useEffect(() => {
    const completed = Object.values(results).filter(r => r.status === 'completed');
    completed.forEach(r => {
      if (!colorPalettes[r.id]) {
        extractPalette(r.processedUrl).then(palette => {
          setColorPalettes(prev => ({ ...prev, [r.id]: palette }));
        });
      }
    });
  }, [results, colorPalettes, extractPalette]);

  // Processing queue state - track individual processing steps
  const [processingSteps, setProcessingSteps] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!isProcessing || !currentProcessingId) return;
    setProcessingSteps(prev => ({
      ...prev,
      [currentProcessingId]: 'Procesando...'
    }));
    const timers = [1, 2, 3].map(sec => setTimeout(() => {
      if (!currentProcessingId) return;
      const steps = ['Eliminando fondo...', 'Aplicando upscale...', 'Optimizando...'];
      setProcessingSteps(prev => ({
        ...prev,
        [currentProcessingId]: steps[sec - 1] || 'Procesando...'
      }));
    }, sec * 2000));
    return () => timers.forEach(clearTimeout);
  }, [isProcessing, currentProcessingId]);

  // Confirm before close if processing
  useEffect(() => {
    if (!isProcessing) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isProcessing]);

  // Toast when processing completes
  useEffect(() => {
    if (!isProcessing && totalCount > 0 && completedCount === totalCount) {
      const errored = Object.values(results).filter(r => r.status === 'error').length;
      if (errored > 0) {
        toast.addToast('warning', `Procesamiento completado con ${errored} error${errored !== 1 ? 'es' : ''}`);
      } else {
        toast.addToast('success', `${totalCount} imagen${totalCount !== 1 ? 'es' : ''} procesada${totalCount !== 1 ? 's' : ''}`);
      }
    }
  }, [isProcessing]);

  // Keyboard shortcuts
  const isStudioActive = viewMode === 'studio';

  useKeyboard([
    { key: '1', handler: () => setViewMode('dashboard'), enabled: !isStudioActive },
    { key: '2', handler: () => setViewMode('upload'), enabled: !isStudioActive },
    { key: '3', handler: () => hasResults && setViewMode('results'), enabled: !isStudioActive },
    { key: '4', handler: () => setViewMode('studio'), enabled: !isStudioActive },
    { key: '5', handler: () => setViewMode('settings'), enabled: !isStudioActive },
    { key: 'e', handler: handleExport, enabled: !isStudioActive },
    { key: '?', handler: () => setShortcutsOpen(true) },
    { key: 'k', ctrl: true, handler: () => setCommandPaletteOpen(true) },
    { key: 'k', meta: true, handler: () => setCommandPaletteOpen(true) },
    { key: 'Delete', handler: () => {
      if (selectedIds.size > 0) handleDeleteBatch();
    }, enabled: !isStudioActive },
    { key: 'Backspace', handler: () => {
      if (selectedIds.size > 0) handleDeleteBatch();
    }, enabled: !isStudioActive },
  ]);

  const paletteCommands = useMemo(() => [
    { id: 'dashboard', label: 'Ir a Dashboard', shortcut: '1', icon: <HomeIcon size={16} />, action: () => setViewMode('dashboard') },
    { id: 'upload', label: 'Ir a Mesa de Trabajo', shortcut: '2', icon: <Upload size={16} />, action: () => setViewMode('upload') },
    { id: 'results', label: 'Ir a Resultados', shortcut: '3', icon: <ImageIcon size={16} />, action: () => hasResults && setViewMode('results'), enabled: hasResults },
    { id: 'studio', label: 'Ir a Design Studio', shortcut: '4', icon: <Palette size={16} />, action: () => setViewMode('studio') },
    { id: 'settings', label: 'Ir a Ajustes', shortcut: '5', icon: <Settings size={16} />, action: () => setViewMode('settings') },
    { id: 'export', label: 'Exportar Todo', shortcut: 'E', icon: <Download size={16} />, action: handleExport, enabled: completedResults.length > 0 },
    { id: 'process', label: 'Procesar Archivos', shortcut: '', icon: <Sparkles size={16} />, action: handleProcess, enabled: files.length > 0 && !isProcessing },
    { id: 'presentation', label: 'Modo Presentación', shortcut: '', icon: <Monitor size={16} />, action: () => { if (completedResults.length > 0) { setPresentationIndex(0); setPresentationOpen(true); } }, enabled: completedResults.length > 0 },
    { id: 'shortcuts', label: 'Ver Atajos de Teclado', shortcut: '?', icon: <Maximize2 size={16} />, action: () => setShortcutsOpen(true) },
  ], [viewMode, hasResults, completedResults, handleExport, handleProcess, files, isProcessing]);

  const gridCols = useMemo(() => {
    const min = 160 + (zoomLevel / 100) * 200;
    return `repeat(auto-fill, minmax(${min}px, 1fr))`;
  }, [zoomLevel]);

  return (
    <div className={styles.container}>
      {/* Sidebar Navigation */}
      <aside className={`${styles.sidebar} ${focusMode ? styles.sidebarCollapsed : ''}`}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <Layers size={14} color="#fff" aria-hidden="true" />
          </div>
          {!focusMode && <span>SmartAsset</span>}
        </div>

        <nav className={styles.nav}>
          <button
            className={`${styles.navItem} ${viewMode === 'dashboard' ? styles.active : ''}`}
            onClick={() => setViewMode('dashboard')}
          >
            <HomeIcon size={16} /> {!focusMode && 'Dashboard'}
          </button>
          <button
            className={`${styles.navItem} ${viewMode === 'upload' ? styles.active : ''}`}
            onClick={() => setViewMode('upload')}
          >
            <Upload size={16} /> {!focusMode && 'Mesa de Trabajo'}
          </button>
          <button
             className={`${styles.navItem} ${viewMode === 'results' ? styles.active : ''}`}
             onClick={() => hasResults && setViewMode('results')}
             disabled={!hasResults}
          >
            <ImageIcon size={16} /> {!focusMode && <>Resultados {hasResults && <span className={styles.badge}>{Object.keys(results).length}</span>}</>}
          </button>
          <button
             className={`${styles.navItem} ${viewMode === 'studio' ? styles.active : ''}`}
             onClick={() => setViewMode('studio')}
          >
             <Palette size={16} /> {!focusMode && 'Design Studio'}
          </button>
          <button
            className={`${styles.navItem} ${viewMode === 'settings' ? styles.active : ''}`}
            onClick={() => setViewMode('settings')}
          >
            <Settings size={16} /> {!focusMode && 'Ajustes'}
          </button>
        </nav>

        {/* Bottom hint */}
        <div style={{
          marginTop: 'auto',
          padding: '0.5rem 1rem',
          fontSize: '0.7rem',
          color: 'var(--text-dim)',
          textAlign: 'center',
        }}>
          <button
            onClick={() => setShortcutsOpen(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.7rem',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              justifyContent: 'center',
              width: '100%',
              padding: '4px 0',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
          >
            <span style={{
              padding: '1px 5px',
              background: 'var(--bg-card)',
              borderRadius: 3,
              border: '1px solid var(--border-subtle)',
              fontSize: 9,
            }}>?</span>
            {' '}Atajos
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Header */}
        <header className={styles.header}>
            <div className={styles.headerContent}>
              <h1>
                {viewMode === 'dashboard' && 'Dashboard'}
                {viewMode === 'upload' && 'Mesa de Trabajo'}
                {viewMode === 'results' && 'Activos Procesados'}
                {viewMode === 'settings' && 'Configuración'}
                {viewMode === 'studio' && 'Design Studio'}
              </h1>
              <p>
                {viewMode === 'dashboard' && 'Resumen de tu actividad y acceso rápido'}
                {viewMode === 'upload' && 'Sube y gestiona tus imágenes'}
                {viewMode === 'results' && 'Revisa y exporta tus activos optimizados'}
                {viewMode === 'settings' && 'Personaliza tu flujo de trabajo'}
                {viewMode === 'studio' && 'Crea composiciones profesionales'}
              </p>
            </div>
            
             <AnimatePresence>
                {viewMode === 'upload' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={styles.actions}
                  >
                   <div className={styles.upscaleToggleWrapper}>
                        <label className={styles.toggleSwitch} htmlFor="upscale-toggle">
                           <input
                             id="upscale-toggle"
                             type="checkbox"
                             checked={shouldUpscale}
                             onChange={(e) => setShouldUpscale(e.target.checked)}
                             aria-label="Activar Upscale IA 2x"
                           />
                           <span className={styles.slider}></span>
                        </label>
                        <label htmlFor="upscale-toggle" className={styles.toggleLabel}>Upscale IA 2x</label>
                  </div>
                    <div className={styles.divider}></div>
                    <div className={styles.stats}>
                      {isProcessing
                        ? <span>{completedCount}/{totalCount} · {results[currentProcessingId || '']?.fileName || '…'}</span>
                        : <span>{files.length} Archivos</span>
                      }
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn-primary"
                        onClick={handleProcess}
                        disabled={isProcessing || files.length === 0}
                      >
                        {isProcessing ? (
                          <span className={styles.btnContent}><Loader2 className={styles.spin} size={18}/> {completedCount}/{totalCount}</span>
                        ) : (
                          <span className={styles.btnContent}><Sparkles size={18}/> Procesar Todo</span>
                        )}
                      </button>
                      {isProcessing && (
                        <button
                          className={styles.secondaryBtn}
                          onClick={handleCancel}
                          style={{ height: 36, borderColor: 'var(--danger)', color: 'var(--danger)' }}
                        >
                          <X size={16} /> Cancelar
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
                
                {viewMode === 'results' && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={styles.actions}
                  >
                    {/* Gallery controls */}
                    <div className={styles.galleryControls}>
                      <button
                        className={`${styles.iconBtn} ${galleryView === 'grid' ? styles.activeIconBtn : ''}`}
                        onClick={() => setGalleryView('grid')}
                        title="Vista cuadrícula"
                      >
                        <Grid3X3 size={16} />
                      </button>
                      <button
                        className={`${styles.iconBtn} ${galleryView === 'list' ? styles.activeIconBtn : ''}`}
                        onClick={() => setGalleryView('list')}
                        title="Vista lista"
                      >
                        <List size={16} />
                      </button>

                      <div className={styles.divider}></div>

                      {/* Zoom slider */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ZoomIn size={14} style={{ color: 'var(--text-dim)' }} />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={zoomLevel}
                          onChange={(e) => setZoomLevel(Number(e.target.value))}
                          style={{
                            width: 60,
                            accentColor: 'var(--primary)',
                            cursor: 'pointer',
                          }}
                          aria-label="Zoom de galería"
                        />
                      </div>

                      <div className={styles.divider}></div>

                      {/* Sort */}
                      <div style={{ position: 'relative' }}>
                        <select
                          value={sortMode}
                          onChange={(e) => setSortMode(e.target.value as any)}
                          style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-muted)',
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            outline: 'none',
                          }}
                          aria-label="Ordenar por"
                        >
                          <option value="date">Más recientes</option>
                          <option value="name">Nombre A-Z</option>
                        </select>
                      </div>

                      <div className={styles.divider}></div>

                      {/* Search */}
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          placeholder="Buscar…"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-main)',
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontSize: '0.8rem',
                            width: 120,
                            outline: 'none',
                            fontFamily: 'inherit',
                          }}
                          aria-label="Buscar por nombre"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            style={{
                              position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                              background: 'transparent', border: 'none', color: 'var(--text-dim)',
                              cursor: 'pointer', padding: 2, display: 'flex',
                            }}
                            aria-label="Limpiar búsqueda"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      <div className={styles.divider}></div>

                      {/* Select all */}
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.8rem',
                        color: 'var(--text-dim)',
                        cursor: 'pointer',
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.size === sortedResults.length && sortedResults.length > 0}
                          onChange={selectAll}
                          style={{ accentColor: 'var(--primary)' }}
                        />
                        Todo
                      </label>
                    </div>

                    {showSeoMenu ? (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={styles.seoInputWrapper}
                        >
                            <input 
                              type="text" 
                              placeholder="Nombre base (ej. nike-air)" 
                              className={styles.seoInput}
                              value={seoPrefix}
                              onChange={(e) => setSeoPrefix(e.target.value)}
                              onKeyDown={(e) => {
                                  if (e.key === 'Enter' && seoPrefix) {
                                      renameBatch(seoPrefix);
                                      setShowSeoMenu(false);
                                  }
                              }}
                              autoFocus
                            />
                            <button className={styles.iconBtn} onClick={() => { renameBatch(seoPrefix); setShowSeoMenu(false); }} aria-label="Aplicar renombrado SEO">
                              <Sparkles size={14} />
                            </button>
                            <button className={styles.iconBtn} onClick={() => setShowSeoMenu(false)} aria-label="Cancelar renombrado SEO">
                              <X size={14}/>
                            </button>
                        </motion.div>
                    ) : (
                        <button className={styles.secondaryBtn} onClick={() => setShowSeoMenu(true)} style={{ height: 32, fontSize: '0.8rem' }}>
                            <Pencil size={14} /> SEO Lote
                        </button>
                    )}

                    <div className={styles.divider}></div>

                    {/* Reprocess */}
                    <button
                      className={styles.secondaryBtn}
                      onClick={handleReprocessBatch}
                      style={{ height: 32, fontSize: '0.8rem' }}
                      disabled={isProcessing}
                    >
                      <Loader2 size={14} /> Reprocesar
                    </button>

                    <div className={styles.divider}></div>

                    {/* Batch delete */}
                    {selectedIds.size > 0 && (
                      <>
                        <button
                          className={styles.secondaryBtn}
                          onClick={handleDeleteBatch}
                          style={{ height: 32, fontSize: '0.8rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                        >
                          <Trash2 size={14} /> ({selectedIds.size})
                        </button>
                        <div className={styles.divider}></div>
                      </>
                    )}

                    <button className="btn-primary" onClick={handleExport} style={{ height: 32, fontSize: '0.8rem', padding: '0 1rem' }}>
                        <div className={styles.btnContent}>
                            <Download size={14} /> Exportar
                        </div>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

            {isProcessing && (
              <div
                className={styles.progressBarLava}
                style={{ width: `${progressPct}%` }}
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progreso: ${completedCount} de ${totalCount}`}
              />
            )}
            </header>

            {/* Content Area */}
            <div className={styles.scrollArea}>

              {/* STUDIO VIEW — always mounted to preserve Fabric.js canvas state */}
              <div style={{display: viewMode === 'studio' ? 'block' : 'none', height: '100%'}}>
                  <DesignStudio
                      assets={completedResults}
                      exportFormat={exportFormat}
                      quality={quality / 100}
                      onDeleteAsset={deleteAsset}
                      focusMode={focusMode}
                  />
              </div>

              {/* DASHBOARD VIEW */}
              {viewMode === 'dashboard' && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className={styles.dashboard}
                >
                  <div className={styles.dashboardMain}>
                    <div className={styles.dashHeader}>
                      <div>
                        <h2 className={styles.dashTitle}>
                          Buenas {stats.totalProcessed > 0 ? 'de vuelta' : 'bienvenido'}
                        </h2>
                        <p className={styles.dashSubtitle}>
                          {stats.totalProcessed > 0
                            ? `${stats.totalProcessed} imágenes procesadas · ${stats.timeSaved}s ahorrados`
                            : 'Sube tu primera imagen para empezar'}
                        </p>
                      </div>
                      <div className={styles.dashQuickActions}>
                        <button className={styles.dashQuickBtn} onClick={() => setViewMode('upload')}>
                          <Upload size={16} /> Subir
                        </button>
                        {completedResults.length > 0 && (
                          <>
                            <button className={styles.dashQuickBtn} onClick={() => setViewMode('results')}>
                              <ImageIcon size={16} /> Resultados
                            </button>
                            <button className={styles.dashQuickBtn} onClick={() => { setPresentationIndex(0); setPresentationOpen(true); }}>
                              <Monitor size={16} /> Presentar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.statsGrid}>
                    <motion.div className={styles.statCard} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                      <div className={styles.statIcon}><ImageIcon size={20} /></div>
                      <div className={styles.statNumber}>{stats.totalProcessed}</div>
                      <div className={styles.statLabel}>Imágenes procesadas</div>
                    </motion.div>
                    <motion.div className={styles.statCard} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                      <div className={styles.statIcon} style={{ background: 'rgba(212,167,106,0.12)', color: 'var(--accent-gold)' }}><Download size={20} /></div>
                      <div className={styles.statNumber}>{stats.totalExports}</div>
                      <div className={styles.statLabel}>Exportaciones realizadas</div>
                    </motion.div>
                    <motion.div className={styles.statCard} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                      <div className={styles.statIcon} style={{ background: 'rgba(107,143,94,0.12)', color: 'var(--success)' }}><Zap size={20} /></div>
                      <div className={styles.statNumber}>{stats.timeSaved}s</div>
                      <div className={styles.statLabel}>Tiempo ahorrado</div>
                    </motion.div>
                  </div>

                  {stats.recentImages.length > 0 && (
                    <div className={styles.recentSection}>
                      <div className={styles.sectionHeader}>
                        <h3 className={styles.sectionTitle}>Recientes</h3>
                        <button className={styles.sectionAction} onClick={() => setTimelineOpen(true)}>
                          <Clock size={14} style={{ marginRight: 4 }} />
                          Ver timeline
                        </button>
                      </div>
                      <div className={styles.recentGrid}>
                        {stats.recentImages.map((r, i) => (
                          <motion.div
                            key={r.id}
                            className={styles.recentCard}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 + i * 0.05 }}
                            onClick={() => {
                              const idx = completedResults.findIndex(cr => cr.id === r.id);
                              if (idx >= 0) { setLightboxIndex(idx); setLightboxOpen(true); }
                            }}
                          >
                            <img src={r.processedUrl} alt={r.fileName} />
                            <div className={styles.recentCardOverlay}>
                              <span className={styles.recentCardName}>{r.fileName}</span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {stats.totalProcessed === 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', paddingTop: '2rem' }}
                    >
                      <EmptyState view="upload" onAction={() => setViewMode('upload')} />
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* ANIMATED VIEWS */}
              <AnimatePresence mode="wait">

              {/* UPLOAD VIEW */}
              {viewMode === 'upload' && (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  style={{ display: 'flex', flexDirection: 'column', flex: 1 }}
                >
                  {files.length > 0 ? (
                    <div className={styles.gallery} style={{ gridTemplateColumns: gridCols }}>
                      <Reorder.Group
                        axis="y"
                        values={files}
                        onReorder={setFiles}
                        as="div"
                        style={{ display: 'contents' }}
                      >
                        {files.map((file) => {
                          const status = results[file.name]?.status;
                          return (
                            <Reorder.Item
                              value={file}
                              key={file.name}
                              as="div"
                              className={`${styles.card} ${styles.cardLiftGlow}`}
                              style={{ listStyle: 'none', cursor: 'grab' }}
                              whileDrag={{ scale: 1.02, zIndex: 50, boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}
                            >
                              <div className={styles.cardImageWrapper}>
                                  <img
                                    src={file.preview}
                                    alt={file.name}
                                    className={styles.cardImage}
                                  />
                                  {!isProcessing && (
                                    <button
                                      onClick={() => removeFile(file.name)}
                                      className={styles.removeBtn}
                                      aria-label={`Eliminar ${file.name}`}
                                    >
                                      <X size={14} />
                                    </button>
                                  )}

                                  {isProcessing && status === undefined && (
                                    <div className={styles.processingOverlay}>
                                      <Loader2 size={20} className={styles.processingSpinner} />
                                      <span className={styles.processingStep}>En cola</span>
                                    </div>
                                  )}

                                  {status === 'processing' && (
                                    <div className={styles.processingOverlay}>
                                      <Loader2 size={20} className={styles.processingSpinner} />
                                      <span className={styles.processingStep}>{processingSteps[file.name] || 'Procesando...'}</span>
                                    </div>
                                  )}

                                  {status === 'completed' && (
                                    <div className={styles.statusOverlaySuccess} aria-label="Completado" role="status">
                                      <Sparkles size={16} aria-hidden="true" />
                                    </div>
                                  )}
                              </div>
                              <div className={styles.cardInfo}>
                                <p className={styles.cardTitle}>{file.name}</p>
                                <p className={styles.cardSize}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                            </Reorder.Item>
                          );
                        })}
                      </Reorder.Group>

                      <div
                          className={`${styles.card} ${styles.miniDrop}`}
                          {...getRootProps()}
                      >
                          <input {...getInputProps()} />
                          <Upload size={24} />
                          <span>Añadir Más</span>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.emptyStateWrapper} {...getRootProps()}>
                      <input {...getInputProps()} />
                      <div style={{ pointerEvents: 'none' }}>
                        <EmptyState
                          view="upload"
                          onAction={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* RESULTS VIEW */}
              {viewMode === 'results' && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                >
                  {sortedResults.length > 0 ? (
                    <div
                      className={galleryView === 'grid' ? styles.gallery : styles.listView}
                      style={galleryView === 'grid' ? { gridTemplateColumns: gridCols } : undefined}
                    >
                      {sortedResults.map(([id, res]) => (
                        <div key={id} className={`${galleryView === 'grid' ? `${styles.card} ${styles.cardLiftGlow}` : styles.listCard}`}>
                          {/* Checkbox (always visible) */}
                          <div
                            style={{
                              position: galleryView === 'grid' ? 'absolute' : 'relative',
                              top: galleryView === 'grid' ? 8 : undefined,
                              left: galleryView === 'grid' ? 8 : undefined,
                              zIndex: 20,
                              padding: galleryView === 'list' ? '0 8px 0 0' : undefined,
                              display: galleryView === 'grid' ? undefined : 'flex',
                              alignItems: 'center',
                            }}
                            className={galleryView === 'grid' ? styles.cardCheckbox : ''}
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.has(id)}
                              onChange={() => toggleSelect(id)}
                              style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>

                          {galleryView === 'grid' ? (
                            /* GRID CARD */
                            <>
                              <div className={styles.imgContainer}>
                                {res.status === 'completed' ? (
                                  <div
                                    className={styles.imgContainerInner}
                                    onClick={() => {
                                      const idx = completedResults.findIndex(r => r.id === id);
                                      if (idx >= 0) { setLightboxIndex(idx); setLightboxOpen(true); }
                                    }}
                                    style={{ cursor: 'pointer' }}
                                    onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ id, x: e.clientX, y: e.clientY }); }}
                                  >
                                    <div className={styles.checkerboard}></div>
                                    <div className={styles.compareSliderOverlay}>
                                        <CompareSlider before={res.originalUrl} after={res.processedUrl} />
                                    </div>
                                    <div style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 15, display: 'flex', gap: 4 }}>
                                      <button
                                        className={styles.miniIconBtn}
                                        onClick={(e) => { e.stopPropagation(); downloadIndividual(id); }}
                                        aria-label={`Descargar ${res.fileName}`}
                                        title="Descargar"
                                      >
                                        <Download size={14} />
                                      </button>
                                      <button
                                        className={styles.miniIconBtn}
                                        onClick={(e) => { e.stopPropagation(); handleDeleteAsset(id); }}
                                        aria-label={`Eliminar ${res.fileName}`}
                                        title="Eliminar"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ) : res.status === 'error' ? (
                                  <div className={styles.imgContainerInner}>
                                    <div className={styles.errorWrapper}>
                                      <div className={styles.errorIcon}>!</div>
                                      <p className={styles.errorMessage}>{res.errorMessage || 'Error al procesar'}</p>
                                      <button
                                        className={styles.retryBtn}
                                        onClick={() => handleRetry(id)}
                                      >
                                        <Loader2 size={14} /> Reintentar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className={styles.imgContainerInner}>
                                    <Loader2 className={styles.spin} />
                                  </div>
                                )}
                              </div>
                              <div className={styles.cardInfo}>
                                  <div className={styles.inputGroup}>
                                    <input
                                        className={styles.fileNameInput}
                                        value={res.fileName}
                                        onChange={(e) => renameFile(res.id, e.target.value)}
                                        aria-label="Nombre de archivo"
                                        data-id={res.id}
                                    />
                                    <Pencil size={12} className={styles.editIcon} aria-hidden="true" />
                                  </div>
                                  {res.originalWidth && res.originalHeight && (
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: 2 }}>
                                      {res.originalWidth} × {res.originalHeight} px
                                    </div>
                                  )}
                                  <div className={styles.cardInfoRow}>
                                    {res.status === 'completed' ? (
                                      <>
                                        <span className={styles.tag}>
                                          {exportFormat === 'jpeg' ? 'Procesado' : 'Fondo Eliminado'}
                                        </span>
                                        <button
                                            className={styles.miniBtn}
                                            onClick={() => setEditingAssetId(id)}
                                            aria-label="Refinar recorte"
                                        >
                                            <Scissors size={12} aria-hidden="true" /> Refinar
                                        </button>
                                      </>
                                    ) : res.status === 'error' ? (
                                      <>
                                        <span className={styles.tag} style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>Error</span>
                                        <button
                                            className={styles.miniBtn}
                                            onClick={() => handleRetry(id)}
                                            aria-label="Reintentar"
                                        >
                                            <Loader2 size={12} /> Reintentar
                                        </button>
                                      </>
                                    ) : (
                                      <span className={styles.tag}>Procesando...</span>
                                    )}
                                  </div>
                                  {res.status === 'completed' && colorPalettes[id] && (
                                    <div className={styles.paletteContainer}>
                                      {colorPalettes[id].map((color, ci) => (
                                        <div
                                          key={ci}
                                          className={styles.paletteSwatch}
                                          style={{ background: color }}
                                          title={color}
                                          onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(color); toast.addToast('info', `Color ${color} copiado`); }}
                                        />
                                      ))}
                                    </div>
                                  )}
                              </div>
                            </>
                          ) : (
                            /* LIST CARD */
                            <div
                              className={styles.listCardInner}
                              onClick={() => {
                                if (res.status === 'completed') {
                                  const idx = completedResults.findIndex(r => r.id === id);
                                  if (idx >= 0) { setLightboxIndex(idx); setLightboxOpen(true); }
                                }
                              }}
                              style={{ cursor: res.status === 'completed' ? 'pointer' : 'default' }}
                            >
                              <div className={styles.listCardPreview}>
                                {res.status === 'completed' ? (
                                  <img src={res.processedUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                ) : res.status === 'error' ? (
                                  <div className={styles.errorWrapper} style={{ padding: '1rem' }}>
                                    <div className={styles.errorIcon}>!</div>
                                    <p className={styles.errorMessage}>{res.errorMessage || 'Error'}</p>
                                    <button
                                      className={styles.retryBtn}
                                      onClick={(e) => { e.stopPropagation(); handleRetry(id); }}
                                    >
                                      <Loader2 size={14} /> Reintentar
                                    </button>
                                  </div>
                                ) : (
                                  <Loader2 className={styles.spin} />
                                )}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <input
                                  className={styles.fileNameInput}
                                  value={res.fileName}
                                  onChange={(e) => renameFile(res.id, e.target.value)}
                                  aria-label="Nombre de archivo"
                                  style={{ fontSize: '0.85rem', fontWeight: 500 }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                {res.originalWidth && res.originalHeight && (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 1, display: 'block' }}>
                                    {res.originalWidth} × {res.originalHeight} px
                                  </span>
                                )}
                                {res.status === 'completed' ? (
                                  <span className={styles.tag} style={{ marginTop: 2 }}>
                                    {exportFormat === 'jpeg' ? 'Procesado' : 'Fondo Eliminado'}
                                  </span>
                                ) : res.status === 'error' ? (
                                  <span className={styles.tag} style={{ marginTop: 2, borderColor: 'var(--danger)', color: 'var(--danger)' }}>Error</span>
                                ) : (
                                  <span className={styles.tag} style={{ marginTop: 2 }}>Procesando...</span>
                                )}
                              </div>
                              {res.status === 'completed' && (
                                <>
                                  <button
                                      className={styles.miniBtn}
                                      onClick={(e) => { e.stopPropagation(); downloadIndividual(id); }}
                                      aria-label="Descargar"
                                      title="Descargar"
                                  >
                                      <Download size={12} /> Descargar
                                  </button>
                                  <button
                                      className={styles.miniBtn}
                                      onClick={(e) => { e.stopPropagation(); setEditingAssetId(id); }}
                                      aria-label="Refinar recorte"
                                  >
                                      <Scissors size={12} /> Refinar
                                  </button>
                                  <button
                                      className={styles.miniBtn}
                                      onClick={(e) => { e.stopPropagation(); handleDeleteAsset(id); }}
                                      aria-label="Eliminar"
                                      style={{ borderColor: 'rgba(255,77,77,0.3)', color: 'var(--danger)' }}
                                  >
                                      <Trash2 size={12} /> Eliminar
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState view="results" onAction={() => setViewMode('upload')} />
                  )}
                </motion.div>
              )}

              {/* SETTINGS VIEW */}
              {viewMode === 'settings' && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className={styles.settingsContainer}>
                      <div className={styles.settingGroup}>
                        <h3>Formato de Exportación</h3>
                        <div className={styles.formatOptions}>
                            {['png', 'webp', 'jpeg'].map((fmt) => (
                              <button
                                key={fmt}
                                className={`${styles.optionBtn} ${exportFormat === fmt ? styles.activeOption : ''}`}
                                onClick={() => setExportFormat(fmt as any)}
                              >
                                {fmt.toUpperCase()}
                              </button>
                            ))}
                        </div>
                        <p className={styles.settingHint}>
                            {exportFormat === 'png' && 'Máxima calidad, fondo transparente. Ideal para archivo.'}
                            {exportFormat === 'webp' && 'Moderno, ultra ligero. Ideal para tiendas online (Shopify, etc).'}
                            {exportFormat === 'jpeg' && 'Clásico. Fondo blanco (sin transparencia). Menor peso.'}
                        </p>
                      </div>

                      <div className={styles.settingGroup}>
                        <h3>Calidad de Compresión ({quality}%)</h3>
                        <input
                            type="range"
                            min="10"
                            max="100"
                            value={quality}
                            onChange={(e) => setQuality(Number(e.target.value))}
                            className={styles.rangeSlider}
                            aria-label={`Calidad de compresión: ${quality}%`}
                            style={{
                              background: `linear-gradient(to right, var(--primary) ${quality}%, var(--border-subtle) ${quality}%)`
                            }}
                        />
                        <p className={styles.settingHint}>Reducir calidad ahorra mucho espacio con poca pérdida visual.</p>
                      </div>

                      <div className={styles.settingGroup}>
                        <h3>Color de Fondo</h3>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                          {[
                            { label: 'Transparente', value: '' },
                            { label: 'Blanco', value: '#FFFFFF' },
                            { label: 'Negro', value: '#000000' },
                            { label: 'Gris', value: '#e0e0e0' },
                          ].map(({ label, value }) => (
                            <button
                              key={value}
                              onClick={() => setBgColor(value)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '8px 14px', borderRadius: 8,
                                background: bgColor === value ? 'var(--primary-dim)' : 'transparent',
                                border: `1px solid ${bgColor === value ? 'var(--primary)' : 'var(--border-subtle)'}`,
                                color: bgColor === value ? 'var(--primary)' : 'var(--text-muted)',
                                cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem',
                                transition: 'all 0.15s',
                              }}
                            >
                              <span style={{
                                width: 18, height: 18, borderRadius: '50%',
                                background: value || 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'18\' height=\'18\'%3E%3Crect width=\'9\' height=\'9\' fill=\'%23ccc\'/%3E%3Crect x=\'9\' y=\'9\' width=\'9\' height=\'9\' fill=\'%23ccc\'/%3E%3Crect x=\'9\' width=\'9\' height=\'9\' fill=\'%23fff\'/%3E%3Crect y=\'9\' width=\'9\' height=\'9\' fill=\'%23fff\'/%3E%3C/svg%3E")',
                                backgroundSize: 'cover',
                                border: value ? 'none' : '1px solid var(--border-subtle)',
                                flexShrink: 0,
                              }} />
                              {label}
                            </button>
                          ))}
                          <label style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                            background: !['', '#FFFFFF', '#000000', '#e0e0e0'].includes(bgColor) ? 'var(--primary-dim)' : 'transparent',
                            border: `1px solid ${!['', '#FFFFFF', '#000000', '#e0e0e0'].includes(bgColor) ? 'var(--primary)' : 'var(--border-subtle)'}`,
                            color: !['', '#FFFFFF', '#000000', '#e0e0e0'].includes(bgColor) ? 'var(--primary)' : 'var(--text-muted)',
                            fontFamily: 'inherit', fontSize: '0.85rem',
                            transition: 'all 0.15s',
                          }}>
                            <input
                              type="color"
                              value={bgColor || '#FFFFFF'}
                              onChange={(e) => setBgColor(e.target.value)}
                              style={{ width: 24, height: 24, border: 'none', cursor: 'pointer', background: 'transparent', padding: 0 }}
                            />
                            Personalizado
                          </label>
                        </div>
                        <p className={styles.settingHint}>
                          {bgColor
                            ? `Fondo sólido ${bgColor} — se aplica al exportar y descargar.`
                            : 'Fondo transparente — ideal para PNG, el fondo se conserva al exportar.'}
                          {exportFormat === 'jpeg' && ' JPEG no soporta transparencia, se usará blanco como fallback.'}
                        </p>
                      </div>

                      <div className={styles.settingGroup}>
                        <h3>Redimensionar Lote</h3>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                          <input
                            type="checkbox"
                            checked={resizeEnabled}
                            onChange={(e) => setResizeEnabled(e.target.checked)}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          Redimensionar al exportar
                        </label>
                        {resizeEnabled && (
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Ancho:</span>
                              <input
                                type="number"
                                value={resizeWidth}
                                onChange={(e) => setResizeWidth(Math.max(1, Number(e.target.value)))}
                                min={1}
                                max={10000}
                                style={{
                                  width: 90, padding: '6px 8px', borderRadius: 6,
                                  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                                  color: 'var(--text-main)', fontFamily: 'inherit', fontSize: '0.85rem',
                                }}
                              />
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>px</span>
                            </div>
                            <span style={{ color: 'var(--text-dim)' }}>×</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Alto:</span>
                              <input
                                type="number"
                                value={resizeHeight}
                                onChange={(e) => setResizeHeight(Math.max(1, Number(e.target.value)))}
                                min={1}
                                max={10000}
                                style={{
                                  width: 90, padding: '6px 8px', borderRadius: 6,
                                  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                                  color: 'var(--text-main)', fontFamily: 'inherit', fontSize: '0.85rem',
                                }}
                              />
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>px</span>
                            </div>
                          </div>
                        )}
                        <p className={styles.settingHint} style={{ marginTop: 8 }}>
                          {resizeEnabled
                            ? `Se redimensionará a ${resizeWidth}×${resizeHeight} px al exportar.`
                            : 'Las imágenes conservan su resolución original.'}
                        </p>
                      </div>

                      <div className={styles.settingGroup}>
                        <h3>Plantillas de Exportación</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                          {presets.length === 0 && (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Sin plantillas guardadas.</p>
                          )}
                          {presets.map((p, i) => (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '6px 10px', borderRadius: 6,
                              background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                            }}>
                              <button
                                onClick={() => {
                                  setExportFormat(p.format as any);
                                  setQuality(p.quality);
                                  setBgColor(p.bgColor);
                                  setShouldUpscale(p.upscale);
                                  toast.addToast('success', `Plantilla "${p.name}" aplicada`);
                                }}
                                style={{
                                  background: 'transparent', border: 'none',
                                  color: 'var(--text-main)', cursor: 'pointer',
                                  fontFamily: 'inherit', fontSize: '0.8rem',
                                  padding: '2px 4px',
                                }}
                              >
                                {p.name}
                              </button>
                              <button
                                onClick={() => {
                                  setPresets(presets.filter((_, j) => j !== i));
                                  toast.addToast('info', `Plantilla "${p.name}" eliminada`);
                                }}
                                style={{
                                  background: 'transparent', border: 'none',
                                  color: 'var(--text-dim)', cursor: 'pointer',
                                  padding: 2, display: 'flex',
                                }}
                                aria-label={`Eliminar plantilla ${p.name}`}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                        {showPresetInput ? (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              type="text"
                              value={presetName}
                              onChange={(e) => setPresetName(e.target.value)}
                              placeholder="Nombre de la plantilla"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && presetName.trim()) {
                                  setPresets([...presets, { name: presetName.trim(), format: exportFormat, quality, bgColor, upscale: shouldUpscale }]);
                                  setPresetName('');
                                  setShowPresetInput(false);
                                  toast.addToast('success', 'Plantilla guardada');
                                }
                              }}
                              autoFocus
                              style={{
                                flex: 1, padding: '8px 12px', borderRadius: 6,
                                background: 'var(--bg-card)', border: '1px solid var(--border-active)',
                                color: 'var(--text-main)', fontFamily: 'inherit', fontSize: '0.9rem',
                              }}
                            />
                            <button
                              onClick={() => setShowPresetInput(false)}
                              style={{
                                background: 'transparent', border: '1px solid var(--border-subtle)',
                                color: 'var(--text-muted)', padding: '8px 12px', borderRadius: 6,
                                cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem',
                              }}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowPresetInput(true)}
                            className="btn-primary"
                            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                          >
                            Guardar configuración actual como plantilla
                          </button>
                        )}
                      </div>

                      <div className={styles.settingGroupDanger}>
                        <h3 className={styles.dangerTitle}>Zona de Peligro</h3>
                        <p className={styles.dangerHint}>
                            Borrar todas las imágenes guardadas en el historial. Esta acción no se puede deshacer.
                        </p>
                        <button
                            className="btn-danger"
                            onClick={() => setShowConfirm(true)}
                        >
                            <Trash2 size={18} aria-hidden="true" /> Borrar Historial
                        </button>
                      </div>
                  </div>
                </motion.div>
              )}

              </AnimatePresence>

            </div>
      </main>

      {/* MASK EDITOR OVERLAY */}
      <AnimatePresence>
        {editingAssetId && results[editingAssetId] && (
           <MaskEditor
              originalUrl={results[editingAssetId].originalUrl}
              processedUrl={results[editingAssetId].processedUrl}
              initialProcessedUrl={results[editingAssetId].initialProcessedUrl || results[editingAssetId].processedUrl}
              onSave={(newBlob) => {
                 updateResultBlob(editingAssetId, newBlob);
                 setEditingAssetId(null);
              }}
              onCancel={() => setEditingAssetId(null)}
           />
        )}
      </AnimatePresence>

      {/* CONFIRM MODAL */}
      <AnimatePresence>
        {showConfirm && (
          <ConfirmModal
            message="¿Estás seguro de querer borrar todo el historial? Esta acción no se puede deshacer."
            onConfirm={() => { clearHistory(); setShowConfirm(false); toast.addToast('info', 'Historial borrado'); }}
            onCancel={() => setShowConfirm(false)}
          />
        )}
      </AnimatePresence>

      {/* CONTEXT MENU */}
      <ContextMenu
        x={ctxMenu?.x ?? 0}
        y={ctxMenu?.y ?? 0}
        isOpen={!!ctxMenu}
        onClose={() => setCtxMenu(null)}
        actions={ctxMenu ? [
          { id: 'lightbox', label: 'Ver en lightbox', icon: <Maximize2 size={14} />, action: () => {
            const idx = completedResults.findIndex(r => r.id === ctxMenu.id);
            if (idx >= 0) { setLightboxIndex(idx); setLightboxOpen(true); }
          }},
          { id: 'download', label: 'Descargar', icon: <Download size={14} />, action: () => downloadIndividual(ctxMenu.id) },
          { id: 'rename', label: 'Renombrar', icon: <Pencil size={14} />, action: () => {
            const input = document.querySelector(`[data-id="${ctxMenu.id}"]`) as HTMLInputElement;
            input?.focus();
            input?.select();
          }},
          { id: 'refine', label: 'Refinar recorte', icon: <Scissors size={14} />, action: () => setEditingAssetId(ctxMenu.id) },
          { id: 'delete', label: 'Eliminar', icon: <Trash2 size={14} />, danger: true, action: () => handleDeleteAsset(ctxMenu.id) },
        ].filter(a => results[ctxMenu.id]?.status === 'completed' || a.id === 'delete') : []}
      />

      {/* IMAGE LIGHTBOX */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      {/* EXPORT PREVIEW */}
      <ExportPreview
        isOpen={exportPreviewOpen}
        onClose={() => setExportPreviewOpen(false)}
        items={exportItems}
        format={exportFormat}
        quality={quality}
        onExport={doExport}
      />

      {/* COMMAND PALETTE */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        commands={paletteCommands}
      />

      {/* KEYBOARD SHORTCUTS */}
      <KeyboardShortcuts
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {/* FOCUS MODE TOGGLE */}
      {viewMode === 'studio' && (
        <button
          className={`${styles.focusToggle} ${focusMode ? styles.focusToggleActive : ''}`}
          onClick={() => setFocusMode(!focusMode)}
          title={focusMode ? 'Salir de modo foco' : 'Modo foco (Sin distracciones)'}
        >
          <Focus size={18} />
        </button>
      )}

      {/* PRESENTATION MODE */}
      <PresentationMode
        images={lightboxImages}
        currentIndex={presentationIndex}
        isOpen={presentationOpen}
        onClose={() => setPresentationOpen(false)}
        onIndexChange={setPresentationIndex}
      />

      {/* PROCESSING TIMELINE */}
      <ProcessingTimeline
        results={results}
        isOpen={timelineOpen}
        onClose={() => setTimelineOpen(false)}
      />
    </div>
  );
}
