"use client";

import { useDropzone } from "react-dropzone";
import { Upload, X, ImageIcon, Download, Loader2, Sparkles, Pencil, Trash2, Scissors, Palette } from "lucide-react";
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

export default function Home() {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const { results, isProcessing, processImages, processBatch, clearHistory, updateResultBlob, deleteAsset, renameFile, renameBatch } = useImageProcessor();
  const [viewMode, setViewMode] = useState<'upload' | 'results' | 'settings' | 'studio'>('upload');
  const [showSeoMenu, setShowSeoMenu] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);

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

  return (
    <div className={styles.container}>
      {/* Sidebar Navigation */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}></div>
          <span>SmartAsset</span>
        </div>

        <nav className={styles.nav}>
          <button 
            className={`${styles.navItem} ${viewMode === 'upload' ? styles.active : ''}`}
            onClick={() => setViewMode('upload')}
          >
            Mesa de Trabajo
          </button>
          <button 
             className={`${styles.navItem} ${viewMode === 'results' ? styles.active : ''}`}
             onClick={() => hasResults && setViewMode('results')}
             disabled={!hasResults}
          >
            Resultados {hasResults && <span className={styles.badge}>•</span>}
          </button>
          <button 
             className={`${styles.navItem} ${viewMode === 'studio' ? styles.active : ''}`}
             onClick={() => setViewMode('studio')}
          >
             <Palette size={16} style={{marginRight:8}} /> Design Studio
          </button>
          <button 
            className={`${styles.navItem} ${viewMode === 'settings' ? styles.active : ''}`}
            onClick={() => setViewMode('settings')}
          >
            Ajustes
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
                       <label className={styles.toggleSwitch}>
                          <input 
                            type="checkbox" 
                            checked={shouldUpscale} 
                            onChange={(e) => setShouldUpscale(e.target.checked)} 
                          />
                          <span className={styles.slider}></span>
                       </label>
                       <span className={styles.toggleLabel}>Upscale IA 2x (Lento)</span>
                  </div>
                    <div className={styles.divider}></div>
                    <div className={styles.stats}>
                      <span>{files.length} Archivos</span>
                    </div>
                    <button 
                      className="btn-primary" 
                      onClick={handleProcess}
                      disabled={isProcessing}
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
                            <button className={styles.iconBtn} onClick={() => { renameBatch(seoPrefix); setShowSeoMenu(false); }}>
                              <Sparkles size={14} />
                            </button>
                            <button className={styles.iconBtn} onClick={() => setShowSeoMenu(false)}>
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
            </header>

            {/* Content Area */}
            <div className={styles.scrollArea}>
              
              {/* UPLOAD VIEW */}
              {viewMode === 'upload' && (
                <>
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
                                    >
                                      <X size={14} />
                                    </button>
                                  )}
                                  
                                  {/* Status Overlay */}
                                  {status === 'completed' && (
                                    <div className={styles.statusOverlaySuccess}>
                                      <Sparkles size={16} />
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
                </>
              )}

              {/* RESULTS VIEW */}
              {viewMode === 'results' && (
                <div className={styles.gallery}>
                  {Object.entries(results).map(([id, res]) => (
                      <div key={id} className={styles.card}>
                        <div className={styles.compareContainer}>
                            {/* Clean Image */}
                            {res.status === 'completed' ? (
                              <div className={styles.resultImageWrapper}>
                                <div className={styles.checkerboard}></div>
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10 }}>
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
                              />
                              <Pencil size={12} className={styles.editIcon} />
                            </div>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'4px'}}>
                              <span className={styles.tag}>Fondo Eliminado</span>
                              {res.status === 'completed' && (
                                <button 
                                    className={styles.miniBtn} 
                                    onClick={() => setEditingAssetId(id)}
                                    title="Refinar Recorte"
                                    style={{display:'flex', alignItems:'center', gap:'4px', background:'rgba(255,255,255,0.1)', border:'none', color:'white', padding:'4px 8px', borderRadius:'4px', cursor:'pointer', fontSize:'0.8rem'}}
                                >
                                    <Scissors size={12} /> Refinar
                                </button>
                              )}
                            </div>
                        </div>
                      </div>
                  ))}
                </div>
              )}
        
              {/* STUDIO VIEW (Persistent) */}
              <div style={{display: viewMode === 'studio' ? 'block' : 'none', height: '100%'}}>
                  <DesignStudio 
                      assets={Object.values(results).filter(r => r.status === 'completed')}
                      exportFormat={exportFormat}
                      quality={quality / 100}
                      onDeleteAsset={deleteAsset}
                  />
              </div>

              {/* SETTINGS VIEW */}
              {viewMode === 'settings' && (
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
                      />
                      <p className={styles.settingHint}>Reducir calidad ahorra mucho espacio con poca pérdida visual.</p>
                    </div>

                    <div className={styles.settingGroup} style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                      <h3 style={{ color: '#ef4444' }}>Zona de Peligro</h3>
                      <p className={styles.settingHint} style={{ marginBottom: '1rem' }}>
                          Borrar todas las imágenes guardadas en el historial. Esta acción no se puede deshacer.
                      </p>
                      <button 
                          className="btn-primary" 
                          style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444' }}
                          onClick={() => {
                              if (confirm('¿Estás seguro de querer borrar todo el historial?')) {
                                  clearHistory();
                                  alert('Historial eliminado.');
                              }
                          }}
                      >
                          <Trash2 size={18} /> Borrar Historial
                      </button>
                    </div>
                </div>
              )}

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
    </div>
  );
}
