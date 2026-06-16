"use client";

import { useDropzone } from "react-dropzone";
import { Upload, X, ImageIcon, Download, Loader2, Sparkles, Pencil, Trash2, Scissors, Palette, Settings, Layers, Grid3X3, List, ArrowUpDown, ZoomIn, Maximize2, Home as HomeIcon, Clock, BarChart3, Play, Monitor, Eye, Focus, Zap, RefreshCw, Sun, Moon } from "lucide-react";
import { useCallback, useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import styles from "./page.module.css";
import { useImageProcessor } from "./hooks/useImageProcessor";
import { downloadAsZip } from "./utils/downloader";
import CompareSlider from "./components/CompareSlider";
import MaskEditor from "./components/MaskEditor";
import dynamic from "next/dynamic";

import { useLocalStorage } from "./hooks/useLocalStorage";
import { useKeyboard } from "./hooks/useKeyboard";
import { useToast } from "./contexts/ToastContext";
import { useTheme } from "./contexts/ThemeContext";
import EmptyState from "./components/EmptyState";
import CommandPalette from "./components/CommandPalette";
import KeyboardShortcuts from "./components/KeyboardShortcuts";
import ConfirmModal from "./components/ConfirmModal";
import ContextMenu from "./components/ContextMenu";
import ProcessingTimeline from "./components/ProcessingTimeline";
import ExportPreview from "./components/ExportPreview";

const DesignStudio = dynamic(() => import("./components/studio/DesignStudio"), { ssr: false });
const PresentationMode = dynamic(() => import("./components/PresentationMode"), { ssr: false });
const ImageLightbox = dynamic(() => import("./components/ImageLightbox"), { ssr: false });

interface FileWithPreview extends File {
  preview: string;
}

function HomeInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const { results, isProcessing, currentProcessingId, modelLoading, modelLoaded, modelProgress, processingProgress, processingStats, getResultIdByFileName, processImages, processBatch, cancelProcessing, retryAsset, clearHistory, updateResultBlob, deleteAsset, deleteMultiple, renameFile, renameBatch } = useImageProcessor();
  const [viewMode, setViewMode] = useState<'dashboard' | 'upload' | 'results' | 'settings' | 'studio'>('dashboard');
  const [showSeoMenu, setShowSeoMenu] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Force re-render on window resize (Electron maximize/minimize)
  const [, forceRender] = useState(0);
  useEffect(() => {
    const onResize = () => forceRender(n => n + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Sync viewMode from URL on mount
  useEffect(() => {
    const view = searchParams.get('view');
    if (view && ['dashboard', 'upload', 'results', 'settings', 'studio'].includes(view)) {
      setViewMode(view as typeof viewMode);
    }
  }, []);

  // Sync viewMode changes to URL
  const navigate = useCallback((view: typeof viewMode) => {
    setViewMode(view);
    router.replace(`?view=${view}`, { scroll: false });
  }, [router]);

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
  const themeCtx = useTheme();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) =>
      Object.assign(file, {
        preview: URL.createObjectURL(file),
      })
    );
    setFiles((prev) => [...prev, ...newFiles]);
    if (viewMode === 'results') navigate('upload');
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
    navigate('results');
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

  const handleClearHistory = () => {
    const count = completedCount;
    clearHistory();
    setShowConfirm(false);
    toast.addToast('info', `Historial borrado (${count} imagen${count !== 1 ? 'es' : ''})`);
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

  // Real processing progress from the AI library
  const processingSteps = processingProgress;

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
    { key: '1', handler: () => navigate('dashboard'), enabled: !isStudioActive },
    { key: '2', handler: () => navigate('upload'), enabled: !isStudioActive },
    { key: '3', handler: () => hasResults && navigate('results'), enabled: !isStudioActive },
    { key: '4', handler: () => navigate('studio'), enabled: !isStudioActive },
    { key: '5', handler: () => navigate('settings'), enabled: !isStudioActive },
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
    { id: 'dashboard', label: 'Ir a Dashboard', shortcut: '1', icon: <HomeIcon size={16} />, action: () => navigate('dashboard') },
    { id: 'upload', label: 'Ir a Mesa de Trabajo', shortcut: '2', icon: <Upload size={16} />, action: () => navigate('upload') },
    { id: 'results', label: 'Ir a Resultados', shortcut: '3', icon: <ImageIcon size={16} />, action: () => hasResults && navigate('results'), enabled: hasResults },
    { id: 'studio', label: 'Ir a Design Studio', shortcut: '4', icon: <Palette size={16} />, action: () => navigate('studio') },
    { id: 'settings', label: 'Ir a Ajustes', shortcut: '5', icon: <Settings size={16} />, action: () => navigate('settings') },
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
      {/* Skip link */}
      <a
        href="#main-content"
        className={styles.skipLink}
      >
        Saltar al contenido principal
      </a>

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
            onClick={() => navigate('dashboard')}
          >
            <HomeIcon size={16} /> {!focusMode && 'Dashboard'}
          </button>
          <button
            className={`${styles.navItem} ${viewMode === 'upload' ? styles.active : ''}`}
            onClick={() => navigate('upload')}
          >
            <Upload size={16} /> {!focusMode && 'Mesa de Trabajo'}
          </button>
          <button
             className={`${styles.navItem} ${viewMode === 'results' ? styles.active : ''}`}
             onClick={() => hasResults && navigate('results')}
             disabled={!hasResults}
          >
            <ImageIcon size={16} /> {!focusMode && <>Resultados {hasResults && <span className={styles.badge}>{Object.keys(results).length}</span>}</>}
          </button>
          <button
             className={`${styles.navItem} ${viewMode === 'studio' ? styles.active : ''}`}
             onClick={() => navigate('studio')}
          >
             <Palette size={16} /> {!focusMode && 'Design Studio'}
          </button>
          <button
            className={`${styles.navItem} ${viewMode === 'settings' ? styles.active : ''}`}
            onClick={() => navigate('settings')}
          >
            <Settings size={16} /> {!focusMode && 'Ajustes'}
          </button>
        </nav>

        {/* Bottom hint */}
        <div className={styles.sidebarFooter}>
          <button
            onClick={() => themeCtx.toggleTheme()}
            className={styles.sidebarShortcutBtn}
            aria-label={`Cambiar a modo ${themeCtx.theme === 'dark' ? 'claro' : 'oscuro'}`}
          >
            {themeCtx.theme === 'dark' ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
            {' '}Tema
          </button>
          <button
            onClick={() => setShortcutsOpen(true)}
            className={styles.sidebarShortcutBtn}
            aria-label="Abrir atajos de teclado"
          >
            <span className={styles.shortcutKey}>?</span>
            {' '}Atajos
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={styles.main} id="main-content">
        {/* Header */}
        <header className={styles.header}>
            <div className={styles.headerContent}>
              <span role="heading" aria-level={viewMode === 'dashboard' ? 2 : 1} className={styles.title}>
                {viewMode === 'dashboard' && 'Dashboard'}
                {viewMode === 'upload' && 'Mesa de Trabajo'}
                {viewMode === 'results' && 'Activos Procesados'}
                {viewMode === 'settings' && 'Configuración'}
                {viewMode === 'studio' && 'Design Studio'}
              </span>
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
                    <div className={styles.actionRow}>
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
                          className={`${styles.secondaryBtn} ${styles.cancelBtn}`}
                          onClick={handleCancel}
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
                      <div className={styles.zoomRow}>
                        <ZoomIn size={14} aria-hidden="true" />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={zoomLevel}
                          onChange={(e) => setZoomLevel(Number(e.target.value))}
                          className={styles.zoomSlider}
                          aria-label="Zoom de galería"
                        />
                      </div>

                      <div className={styles.divider}></div>

                      {/* Sort */}
                      <div className={styles.selectWrapper}>
                        <select
                          value={sortMode}
                          onChange={(e) => setSortMode(e.target.value as any)}
                          className={styles.sortSelect}
                          aria-label="Ordenar por"
                        >
                          <option value="date">Más recientes</option>
                          <option value="name">Nombre A-Z</option>
                        </select>
                      </div>

                      <div className={styles.divider}></div>

                      {/* Search */}
                      <div className={styles.searchWrapper}>
                        <input
                          type="text"
                          placeholder="Buscar…"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className={styles.searchInput}
                          aria-label="Buscar por nombre"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className={styles.searchClearBtn}
                            aria-label="Limpiar búsqueda"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      <div className={styles.divider}></div>

                      {/* Select all */}
                      <label className={styles.selectAllLabel}>
                        <input
                          type="checkbox"
                          checked={selectedIds.size === sortedResults.length && sortedResults.length > 0}
                          onChange={selectAll}
                          className={styles.selectAllCheckbox}
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
                        <button className={`${styles.secondaryBtn} ${styles.secondaryBtnSm}`} onClick={() => setShowSeoMenu(true)}>
                            <Pencil size={14} /> SEO Lote
                        </button>
                    )}

                    <div className={styles.divider}></div>

                    {/* Reprocess */}
                    <button
                      className={`${styles.secondaryBtn} ${styles.secondaryBtnSm}`}
                      onClick={handleReprocessBatch}
                      disabled={isProcessing}
                    >
                      <Loader2 size={14} /> Reprocesar
                    </button>

                    <div className={styles.divider}></div>

                    {/* Batch delete */}
                    {selectedIds.size > 0 && (
                      <>
                        <button
                          className={`${styles.secondaryBtn} ${styles.secondaryBtnSm} ${styles.secondaryBtnDanger}`}
                          onClick={handleDeleteBatch}
                        >
                          <Trash2 size={14} /> ({selectedIds.size})
                        </button>
                        <div className={styles.divider}></div>
                      </>
                    )}

                    <button className={`btn-primary ${styles.exportBtn}`} onClick={handleExport}>
                        <div className={styles.btnContent}>
                            <Download size={14} /> Exportar
                        </div>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

            {(isProcessing || modelLoading) && (
              <div
                className={styles.progressBarLava}
                style={{ width: `${modelLoading ? modelProgress : progressPct}%` }}
                role="progressbar"
                aria-valuenow={modelLoading ? modelProgress : progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={modelLoading ? 'Descargando modelo de IA...' : `Progreso: ${completedCount} de ${totalCount}`}
              />
            )}
            </header>

            {/* Content Area */}
            <div className={styles.scrollArea}>

              {/* STUDIO VIEW — always mounted to preserve Fabric.js canvas state */}
              <div className={styles.studioContainer} style={{display: viewMode === 'studio' ? 'block' : 'none'}}>
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
                        <h1 className={styles.dashTitle}>
                          Buenas {stats.totalProcessed > 0 ? 'de vuelta' : 'bienvenido'}
                        </h1>
                        <p className={styles.dashSubtitle}>
                          {stats.totalProcessed > 0
                            ? `${stats.totalProcessed} imágenes procesadas · ${stats.timeSaved}s ahorrados`
                            : 'Sube tu primera imagen para empezar'}
                        </p>
                      </div>
                      <div className={styles.dashQuickActions}>
                        <button className={styles.dashQuickBtn} onClick={() => navigate('upload')}>
                          <Upload size={16} /> Subir
                        </button>
                        {completedResults.length > 0 && (
                          <>
                            <button className={styles.dashQuickBtn} onClick={() => navigate('results')}>
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
                    <div className={`${styles.statIcon} ${styles.statIconGold}`}><Download size={20} /></div>
                    <div className={styles.statNumber}>{stats.totalExports}</div>
                    <div className={styles.statLabel}>Exportaciones realizadas</div>
                  </motion.div>
                  <motion.div className={styles.statCard} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                    <div className={`${styles.statIcon} ${styles.statIconSuccess}`}><Zap size={20} /></div>
                    <div className={styles.statNumber}>{stats.timeSaved}s</div>
                    <div className={styles.statLabel}>Tiempo ahorrado</div>
                  </motion.div>
                  {processingStats.totalProcessed > 0 && (
                    <motion.div className={styles.statCard} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                      <div className={`${styles.statIcon} ${styles.statIconPrimary}`}><BarChart3 size={20} /></div>
                        <div className={styles.statNumber}>{processingStats.avgTimeMs > 0 ? `${(processingStats.avgTimeMs / 1000).toFixed(1)}s` : '—'}</div>
                        <div className={styles.statLabel}>
                          {processingStats.totalErrors > 0
                            ? `Promedio · ${processingStats.totalErrors} error${processingStats.totalErrors !== 1 ? 'es' : ''}`
                            : 'Promedio por imagen'}
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {stats.recentImages.length > 0 && (
                    <div className={styles.recentSection}>
                      <div className={styles.sectionHeader}>
                        <h3 className={styles.sectionTitle}>Recientes</h3>
                        <button className={styles.sectionAction} onClick={() => setTimelineOpen(true)}>
                          <Clock size={14} className={styles.clockIcon} />
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
                      className={styles.emptyStateWrapper}
                    >
                      <EmptyState view="upload" onAction={() => navigate('upload')} />
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
                  className={styles.uploadContainer}
                >
                  {files.length > 0 ? (
                    <div className={styles.gallery} style={{ gridTemplateColumns: gridCols }}>
                      <Reorder.Group
                        axis="y"
                        values={files}
                        onReorder={setFiles}
                        as="div"
                        className={styles.reorderGroup}
                      >
                        {files.map((file) => {
                          const resultId = getResultIdByFileName(file.name);
                          const status = resultId ? results[resultId]?.status : undefined;
                          return (
                            <Reorder.Item
                              value={file}
                              key={file.name}
                              as="div"
                              className={`${styles.card} ${styles.cardLiftGlow} ${styles.reorderItem}`}
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
                                      <span className={styles.processingStep}>{resultId ? (processingProgress[resultId] || 'Procesando...') : 'En cola'}</span>
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
                      <div className={styles.uploadDropDisabled}>
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
                          <div className={galleryView === 'grid' ? `${styles.cardCheckbox} ${styles.checkboxGrid}` : styles.checkboxList}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(id)}
                              onChange={() => toggleSelect(id)}
                              className={styles.resultCheckbox}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>

                          {galleryView === 'grid' ? (
                            /* GRID CARD */
                            <>
                              <div className={styles.imgContainer}>
                                {res.status === 'completed' ? (
                                  <div
                                    className={`${styles.imgContainerInner} ${styles.imgContainerClickable}`}
                                    onClick={() => {
                                      const idx = completedResults.findIndex(r => r.id === id);
                                      if (idx >= 0) { setLightboxIndex(idx); setLightboxOpen(true); }
                                    }}
                                    onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ id, x: e.clientX, y: e.clientY }); }}
                                  >
                                    <div className={styles.checkerboard}></div>
                                    <div className={styles.compareSliderOverlay}>
                                        <CompareSlider
                                          before={res.wasUpscaled && res.initialProcessedUrl ? res.initialProcessedUrl : res.originalUrl}
                                          after={res.processedUrl}
                                        />
                                    </div>
                                    <div className={styles.downloadOverlay}>
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
                                    <div className={styles.dimText}>
                                      Original: {res.originalWidth} × {res.originalHeight} px
                                    </div>
                                  )}
                                  {res.wasUpscaled && res.processedWidth && res.processedHeight && (
                                    <div className={styles.upscaleText}>
                                      Upscaled: {res.processedWidth} × {res.processedHeight} px (2x)
                                    </div>
                                  )}
                                  {res.processingTimeMs != null && (
                                    <div className={styles.processingTimeText}>
                                      {(res.processingTimeMs / 1000).toFixed(1)}s
                                    </div>
                                  )}
                                  <div className={styles.cardInfoRow}>
                                    {res.status === 'completed' ? (
                                      <>
                                        <span className={styles.tag}>
                                          {exportFormat === 'jpeg' ? 'Procesado' : 'Fondo Eliminado'}
                                        </span>
                                        {res.wasUpscaled && (
                                          <span className={`${styles.tag} ${styles.tagSuccess}`}>
                                            Upscale 2x
                                          </span>
                                        )}
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
                                        <span className={`${styles.tag} ${styles.tagDanger}`}>Error</span>
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
                              className={`${styles.listCardInner} ${res.status === 'completed' ? styles.listCardClickable : ''}`}
                              onClick={() => {
                                if (res.status === 'completed') {
                                  const idx = completedResults.findIndex(r => r.id === id);
                                  if (idx >= 0) { setLightboxIndex(idx); setLightboxOpen(true); }
                                }
                              }}
                            >
                              <div className={styles.listCardPreview}>
                                {res.status === 'completed' ? (
                                  <img src={res.processedUrl} alt="" className={styles.listCardPreviewImg} />
                                ) : res.status === 'error' ? (
                                  <div className={`${styles.errorWrapper} ${styles.errorWrapperContent}`}>
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
                              <div className={styles.listCardInfo}>
                                <input
                                  className={`${styles.fileNameInput} ${styles.listCardName}`}
                                  value={res.fileName}
                                  onChange={(e) => renameFile(res.id, e.target.value)}
                                  aria-label="Nombre de archivo"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                {res.originalWidth && res.originalHeight && (
                                  <span className={styles.listCardDimText}>
                                    Original: {res.originalWidth} × {res.originalHeight} px
                                  </span>
                                )}
                                {res.wasUpscaled && res.processedWidth && res.processedHeight && (
                                  <span className={styles.listCardUpscale}>
                                    Upscaled: {res.processedWidth} × {res.processedHeight} px (2x)
                                  </span>
                                )}
                                <div className={styles.listCardTags}>
                                {res.status === 'completed' ? (
                                  <>
                                    <span className={styles.tag}>
                                      {exportFormat === 'jpeg' ? 'Procesado' : 'Fondo Eliminado'}
                                    </span>
                                    {res.wasUpscaled && (
                                      <span className={`${styles.tag} ${styles.tagSuccess}`}>
                                        Upscale 2x
                                      </span>
                                    )}
                                  </>
                                ) : res.status === 'error' ? (
                                  <span className={`${styles.tag} ${styles.tagDanger}`}>Error</span>
                                ) : (
                                  <span className={styles.tag}>Procesando...</span>
                                )}
                                </div>
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
                                      className={`${styles.miniBtn} ${styles.miniBtnDanger}`}
                                      onClick={(e) => { e.stopPropagation(); handleDeleteAsset(id); }}
                                      aria-label="Eliminar"
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
                    <EmptyState view="results" onAction={() => navigate('upload')} />
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
                        <div className={styles.colorRow}>
                          {[
                            { label: 'Transparente', value: '' },
                            { label: 'Blanco', value: '#FFFFFF' },
                            { label: 'Negro', value: '#000000' },
                            { label: 'Gris', value: '#e0e0e0' },
                          ].map(({ label, value }) => (
                            <button
                              key={value}
                              onClick={() => setBgColor(value)}
                              className={styles.colorOption}
                              data-active={bgColor === value || undefined}
                            >
                              <span className={styles.colorSwatch} style={{
                                background: value || 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'18\' height=\'18\'%3E%3Crect width=\'9\' height=\'9\' fill=\'%23ccc\'/%3E%3Crect x=\'9\' y=\'9\' width=\'9\' height=\'9\' fill=\'%23ccc\'/%3E%3Crect x=\'9\' width=\'9\' height=\'9\' fill=\'%23fff\'/%3E%3Crect y=\'9\' width=\'9\' height=\'9\' fill=\'%23fff\'/%3E%3C/svg%3E")',
                                backgroundSize: 'cover',
                                border: value ? 'none' : '1px solid var(--border-subtle)',
                              }} />
                              {label}
                            </button>
                          ))}
                          <label
                            className={styles.colorOption}
                            data-active={!['', '#FFFFFF', '#000000', '#e0e0e0'].includes(bgColor) || undefined}
                          >
                            <input
                              type="color"
                              value={bgColor || '#FFFFFF'}
                              onChange={(e) => setBgColor(e.target.value)}
                              className={styles.customColorInput}
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
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={resizeEnabled}
                            onChange={(e) => setResizeEnabled(e.target.checked)}
                            className={styles.settingCheckbox}
                          />
                          Redimensionar al exportar
                        </label>
                        {resizeEnabled && (
                          <div className={styles.resizeRow}>
                            <div className={styles.resizeField}>
                              <span className={styles.resizeLabel}>Ancho:</span>
                              <input
                                type="number"
                                value={resizeWidth}
                                onChange={(e) => setResizeWidth(Math.max(1, Number(e.target.value)))}
                                min={1}
                                max={10000}
                                className={styles.resizeInput}
                              />
                              <span className={styles.resizeUnit}>px</span>
                            </div>
                            <span className={styles.resizeSep}>×</span>
                            <div className={styles.resizeField}>
                              <span className={styles.resizeLabel}>Alto:</span>
                              <input
                                type="number"
                                value={resizeHeight}
                                onChange={(e) => setResizeHeight(Math.max(1, Number(e.target.value)))}
                                min={1}
                                max={10000}
                                className={styles.resizeInput}
                              />
                              <span className={styles.resizeUnit}>px</span>
                            </div>
                          </div>
                        )}
                        <p className={styles.settingHint}>
                          {resizeEnabled
                            ? `Se redimensionará a ${resizeWidth}×${resizeHeight} px al exportar.`
                            : 'Las imágenes conservan su resolución original.'}
                        </p>
                      </div>

                      <div className={styles.settingGroup}>
                        <h3>Plantillas de Exportación</h3>
                        <div className={styles.presetsRow}>
                          {presets.length === 0 && (
                            <p className={styles.presetsEmpty}>Sin plantillas guardadas.</p>
                          )}
                          {presets.map((p, i) => (
                            <div key={i} className={styles.presetBadge}>
                              <button
                                onClick={() => {
                                  setExportFormat(p.format as any);
                                  setQuality(p.quality);
                                  setBgColor(p.bgColor);
                                  setShouldUpscale(p.upscale);
                                  toast.addToast('success', `Plantilla "${p.name}" aplicada`);
                                }}
                                className={styles.presetBtn}
                              >
                                {p.name}
                              </button>
                              <button
                                onClick={() => {
                                  setPresets(presets.filter((_, j) => j !== i));
                                  toast.addToast('info', `Plantilla "${p.name}" eliminada`);
                                }}
                                className={styles.presetDeleteBtn}
                                aria-label={`Eliminar plantilla ${p.name}`}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                        {showPresetInput ? (
                          <div className={styles.presetInputRow}>
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
                              className={styles.presetInput}
                            />
                            <button
                              onClick={() => setShowPresetInput(false)}
                              className={styles.presetCancelBtn}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowPresetInput(true)}
                            className={`btn-primary ${styles.presetSaveBtn}`}
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
            onConfirm={handleClearHistory}
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
          aria-label={focusMode ? 'Salir de modo foco' : 'Modo foco (Sin distracciones)'}
        >
          <Focus size={18} aria-hidden="true" />
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

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  );
}
