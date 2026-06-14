"use client";

import { useDropzone } from "react-dropzone";
import { Upload, X, ImageIcon, Download, Loader2, Sparkles, Pencil, Trash2, Scissors, Palette, Settings, Layers } from "lucide-react";
import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./page.module.css";
import { useImageProcessor } from "./hooks/useImageProcessor";
import { downloadAsZip } from "./utils/downloader";
import CompareSlider from "./components/CompareSlider";
import MaskEditor from "./components/MaskEditor";
import DesignStudio from "./components/studio/DesignStudio";
import { useLocalStorage } from "./hooks/useLocalStorage";

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
          background: '#18181b', border: '1px solid #3f3f46', borderRadius: 16,
          padding: '2rem', maxWidth: 400, width: '90%', display: 'flex', flexDirection: 'column', gap: '1.5rem',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Confirmación"
      >
        <p style={{ color: '#fff', fontSize: '0.95rem', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ background: 'transparent', border: '1px solid #3f3f46', color: '#a1a1aa', padding: '0.5rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#ef4444', padding: '0.5rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 600 }}
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
  const { results, isProcessing, processImages, processBatch, clearHistory, updateResultBlob, deleteAsset, renameFile, renameBatch } = useImageProcessor();
  const [viewMode, setViewMode] = useState<'upload' | 'results' | 'settings' | 'studio'>('upload');
  const [showSeoMenu, setShowSeoMenu] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Settings State (Persistent)
  const [seoPrefix, setSeoPrefix] = useLocalStorage('seo_prefix', '');
  const [exportFormat, setExportFormat] = useLocalStorage<'png' | 'webp' | 'jpeg'>('export_format', 'png');
  const [quality, setQuality] = useLocalStorage('export_quality', 90);
  const [shouldUpscale, setShouldUpscale] = useLocalStorage('upscale_enabled', false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) =>
      Object.assign(file, {
        preview: URL.createObjectURL(file), // Create a local preview URL
      })
    );
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
  });

  const removeFile = (name: string) => {
    setFiles((files) => files.filter((file) => file.name !== name));
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    processBatch(files); // Fire and forget (updates via state)
    setViewMode('results');
  };

  const handleExport = async () => {
     const completedResults = Object.values(results).filter(r => r.status === 'completed');
     if (completedResults.length > 0) {
        // Pass settings to downloader
        await downloadAsZip(completedResults, exportFormat, quality / 100);
     }
  };

  const hasResults = Object.keys(results).length > 0;

  const completedCount = Object.values(results).filter(r => r.status === 'completed').length;
  const totalCount = Object.keys(results).length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className={styles.container}>
      {/* Sidebar Navigation */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <Layers size={14} color="#fff" aria-hidden="true" />
          </div>
          <span>SmartAsset</span>
        </div>

        <nav className={styles.nav}>
          <button
            className={`${styles.navItem} ${viewMode === 'upload' ? styles.active : ''}`}
            onClick={() => setViewMode('upload')}
          >
            <Upload size={16} /> Mesa de Trabajo
          </button>
          <button
             className={`${styles.navItem} ${viewMode === 'results' ? styles.active : ''}`}
             onClick={() => hasResults && setViewMode('results')}
             disabled={!hasResults}
          >
            <ImageIcon size={16} /> Resultados {hasResults && <span className={styles.badge}>{Object.keys(results).length}</span>}
          </button>
          <button
             className={`${styles.navItem} ${viewMode === 'studio' ? styles.active : ''}`}
             onClick={() => setViewMode('studio')}
          >
             <Palette size={16} /> Design Studio
          </button>
          <button
            className={`${styles.navItem} ${viewMode === 'settings' ? styles.active : ''}`}
            onClick={() => setViewMode('settings')}
          >
            <Settings size={16} /> Ajustes
          </button>
        </nav>

        {/* Studio Panel (Only visible when active, but kept simple here) */}
      </aside>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Header */}
        <header className={styles.header}>
            <div className={styles.headerContent}>
              <h1>
                {viewMode === 'upload' && 'Mesa de Trabajo'}
                {viewMode === 'results' && 'Activos Procesados'}
                {viewMode === 'settings' && 'Configuración'}
                {viewMode === 'studio' && 'Design Studio'}
              </h1>
              <p>
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
                       <label htmlFor="upscale-toggle" className={styles.toggleLabel}>Upscale IA 2x (Lento)</label>
                  </div>
                    <div className={styles.divider}></div>
                    <div className={styles.stats}>
                      {isProcessing
                        ? <span>{completedCount}/{totalCount} procesados</span>
                        : <span>{files.length} Archivos</span>
                      }
                    </div>
                    <button
                      className="btn-primary"
                      onClick={handleProcess}
                      disabled={isProcessing || files.length === 0}
                    >
                      {isProcessing ? (
                        <span className={styles.btnContent}><Loader2 className={styles.spin} size={18}/> Procesando...</span>
                      ) : (
                        <span className={styles.btnContent}><Sparkles size={18}/> Procesar Todo</span>
                      )}
                    </button>
                  </motion.div>
                )}
                
                {viewMode === 'results' && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={styles.actions}
                  >
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
                        <button className={styles.secondaryBtn} onClick={() => setShowSeoMenu(true)}>
                            <Pencil size={16} /> SEO Lote
                        </button>
                    )}

                    <div className={styles.divider}></div>

                    <button className="btn-primary" onClick={handleExport}>
                        <div className={styles.btnContent}>
                            <Download size={18} /> Exportar Todo
                        </div>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

            {isProcessing && (
              <div
                className={styles.progressBar}
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
                      assets={Object.values(results).filter(r => r.status === 'completed')}
                      exportFormat={exportFormat}
                      quality={quality / 100}
                      onDeleteAsset={deleteAsset}
                  />
              </div>

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
                  {files.length > 0 && (
                    <div className={styles.gallery}>
                      <AnimatePresence>
                        {files.map((file) => {
                          const status = results[file.name]?.status;
                          return (
                            <motion.div
                              layout
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.1 } }}
                              key={file.name}
                              className={styles.card}
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

                                  {/* Status Overlay */}
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
                            </motion.div>
                          );
                        })}

                        <div
                            className={`${styles.card} ${styles.miniDrop}`}
                            {...getRootProps()}
                        >
                            <input {...getInputProps()} />
                            <Upload size={24} className={styles.miniDropIcon} />
                            <span>Añadir Más</span>
                        </div>
                      </AnimatePresence>
                    </div>
                  )}

                  {files.length === 0 && (
                    <div className={styles.emptyStateWrapper}>
                      <div
                        {...getRootProps()}
                        className={`${styles.dropZone} ${isDragActive ? styles.active : ""}`}
                      >
                        <input {...getInputProps()} />
                        <div className={styles.dropIcon}>
                          {isDragActive ? <Upload size={48} /> : <ImageIcon size={48} />}
                        </div>
                        <h3>{isDragActive ? "Suelta los archivos aquí" : "Arrastra y suelta imágenes aquí"}</h3>
                        <p>o haz clic para buscar</p>
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
                  <div className={styles.gallery}>
                    {Object.entries(results).map(([id, res]) => (
                        <div key={id} className={styles.card}>
                          <div className={styles.compareContainer}>
                              {res.status === 'completed' ? (
                                <div className={styles.resultImageWrapper}>
                                  <div className={styles.checkerboard}></div>
                                  <div className={styles.compareSliderOverlay}>
                                      <CompareSlider before={res.originalUrl} after={res.processedUrl} />
                                  </div>
                                </div>
                              ) : (
                                <div className={styles.loadingWrapper}>
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
                                />
                                <Pencil size={12} className={styles.editIcon} aria-hidden="true" />
                              </div>
                              <div className={styles.cardInfoRow}>
                                <span className={styles.tag}>Fondo Eliminado</span>
                                {res.status === 'completed' && (
                                  <button
                                      className={styles.miniBtn}
                                      onClick={() => setEditingAssetId(id)}
                                      aria-label="Refinar recorte"
                                  >
                                      <Scissors size={12} aria-hidden="true" /> Refinar
                                  </button>
                                )}
                              </div>
                          </div>
                        </div>
                    ))}
                  </div>
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
            onConfirm={() => { clearHistory(); setShowConfirm(false); }}
            onCancel={() => setShowConfirm(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
