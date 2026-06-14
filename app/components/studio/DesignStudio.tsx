"use client";

import { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric'; 
import { Download, Type, Image as ImageIcon, Layers, Move, Trash, Square, ChevronUp, ChevronDown, Eye, Lock, Upload, X, Bold, Italic, AlignCenter, AlignLeft, AlignRight, AlignStartVertical, AlignEndVertical, Smartphone, Monitor, LayoutTemplate, Sun, Thermometer, Contrast, Palette, Blend, AlignVerticalJustifyCenter, AlignHorizontalJustifyCenter, Focus } from 'lucide-react';
import styles from './DesignStudio.module.css';
import { ProcessedResult } from '../../hooks/useImageProcessor';
import { useLocalStorage } from '../../hooks/useLocalStorage';

interface TemplatePreset {
  name: string;
  width: number;
  height: number;
  bg: string;
  description: string;
}

const TEMPLATES: TemplatePreset[] = [
  { name: 'Amazon', width: 1000, height: 1000, bg: '#ffffff', description: 'Cuadrado 1:1' },
  { name: 'Etsy', width: 2000, height: 2000, bg: '#ffffff', description: 'Cuadrado premium' },
  { name: 'eBay', width: 1600, height: 1600, bg: '#ffffff', description: 'Cuadrado estándar' },
  { name: 'Instagram', width: 1080, height: 1080, bg: '#ffffff', description: 'Feed cuadrado' },
  { name: 'Pinterest', width: 1000, height: 1500, bg: '#ffffff', description: 'Vertical 2:3' },
  { name: 'Shopify', width: 2048, height: 2048, bg: '#ffffff', description: 'Alta resolución' },
  { name: 'Mercado Libre', width: 800, height: 800, bg: '#ffffff', description: 'Estándar ML' },
  { name: 'Lifestyle', width: 1920, height: 1080, bg: '#f5f0eb', description: 'Panorámico' },
];

const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference',
  'exclusion', 'hue', 'saturation', 'color', 'luminosity',
];

interface DesignStudioProps {
  assets?: ProcessedResult[]; 
  onBack?: () => void;        
  exportFormat: 'png' | 'webp' | 'jpeg';
  quality: number;
  onDeleteAsset?: (id: string) => void;
  focusMode?: boolean;
}

export default function DesignStudio({ assets = [], onBack, exportFormat, quality, onDeleteAsset, focusMode = false }: DesignStudioProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);
  const [, forceUpdate] = useState(0); // Force re-render for deep object updates
  
  // UI State
  const [activeTab, setActiveTab] = useState<'properties' | 'layers'>('properties');
  const [layers, setLayers] = useState<fabric.Object[]>([]);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [showTemplates, setShowTemplates] = useState(false);
  const [blendMode, setBlendMode] = useState('normal');
  
  // Canvas Dimensions & Scale (Persistent)
  const [canvasWidth, setCanvasWidth] = useLocalStorage('studio_width', 1080);
  const [canvasHeight, setCanvasHeight] = useLocalStorage('studio_height', 1080);
  const [scale, setScale] = useState(1);
  
  // DnD State
  const [draggedLayerIndex, setDraggedLayerIndex] = useState<number | null>(null);

  // Custom uploaded assets
  const [customAssets, setCustomAssets] = useState<{url: string, name: string}[]>([]);

  // Undo/Redo State
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isHistoryAction, setIsHistoryAction] = useState(false); // Prevent loop

  const saveHistory = () => {
    if(!canvas || isHistoryAction) return;

    try {
        const json = JSON.stringify(canvas.toJSON());
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(json);
        
        if (newHistory.length > 30) newHistory.shift(); // Limit

        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    } catch(e) { console.error("History Save Error", e); }
  };

  const undo = async () => {
      if (historyIndex > 0) {
          setIsHistoryAction(true);
          const newIndex = historyIndex - 1;
          const json = history[newIndex];
          
          await canvas?.loadFromJSON(JSON.parse(json));
          canvas?.requestRenderAll();
          setHistoryIndex(newIndex);
          updateLayers(); // Sync layers
          setIsHistoryAction(false);
      }
  };

  const redo = async () => {
       if (historyIndex < history.length - 1) {
          setIsHistoryAction(true);
          const newIndex = historyIndex + 1;
          const json = history[newIndex];

          await canvas?.loadFromJSON(JSON.parse(json));
          canvas?.requestRenderAll();
          setHistoryIndex(newIndex);
          updateLayers();
          setIsHistoryAction(false);
       }
  };

  // Auto Fit Logic
  const fitToScreen = () => {
      const container = containerRef.current;
      if (!container || !canvasWidth || !canvasHeight) return;
      
      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) return;

      const padding = 60; 
      const availableWidth = clientWidth - padding;
      const availableHeight = clientHeight - padding;

      const scaleX = availableWidth / canvasWidth;
      const scaleY = availableHeight / canvasHeight;

      const finalScale = Math.min(scaleX, scaleY, 1) * 0.9; 
      setScale(finalScale);
  };

  // Monitor Resize & Visibility
  useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const observer = new ResizeObserver(() => {
          fitToScreen();
      });
      observer.observe(container);
      
      fitToScreen();

      return () => observer.disconnect();
  }, [canvasWidth, canvasHeight]);


  // Update layer list from canvas
  const updateLayers = () => {
      if (!canvas) return;
      setLayers([...canvas.getObjects()].reverse());
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const fabricCanvas = new fabric.Canvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      perPixelTargetFind: true, 
      targetFindTolerance: 4
    });

    fabricCanvas.on('mouse:wheel', (opt) => {
        const delta = opt.e.deltaY;
        const activeObject = fabricCanvas.getActiveObject();

        if (opt.e.ctrlKey) {
            opt.e.preventDefault();
            opt.e.stopPropagation();

            if (activeObject) {
                const scaleCheck = activeObject.scaleX || 1;
                const newScale = delta > 0 ? scaleCheck * 0.95 : scaleCheck * 1.05;
                activeObject.scale(newScale);
                activeObject.setCoords();
                // Notify modification
                fabricCanvas.fire('object:modified', { target: activeObject });
            }
            fabricCanvas.requestRenderAll();
        }
    });

    fabricCanvas.on('selection:created', (e) => setSelectedObject(e.selected?.[0] || null));
    fabricCanvas.on('selection:updated', (e) => setSelectedObject(e.selected?.[0] || null));
    fabricCanvas.on('selection:cleared', () => setSelectedObject(null));
    
    // Listeners moved to separate effect to access store state


    setCanvas(fabricCanvas);

    return () => {
      fabricCanvas.dispose();
    };
  }, []); // Initialize ONCE. Do not depend on dimensions.

  // Handle Resize Separately to preserve objects
  useEffect(() => {
    if (canvas && canvasWidth && canvasHeight) {
        canvas.setDimensions({ width: canvasWidth, height: canvasHeight });
        canvas.requestRenderAll();
        // Optional: Recenter content or just re-render
    }
  }, [canvas, canvasWidth, canvasHeight]);

  // Phase 1: Keyboard Shortcuts & History Listeners
  useEffect(() => {
    if (!canvas) return;
    
    // Configure History Listeners
    const onModify = () => {
        updateLayers();
        saveHistory();
    };
    
    canvas.on('object:modified', onModify);
    canvas.on('object:added', onModify);
    canvas.on('object:removed', onModify);
    
    // SMART GUIDES (Snapping) — Enhanced with edge snapping
    let guidelines: { v: number; h: number }[] = [];

    canvas.on('object:moving', (e) => {
        const obj = e.target;
        if (!obj || !canvas) return;

        const bounds = obj.getBoundingRect();
        const { left, top, width, height } = bounds;
        const right = left + width;
        const bottom = top + height;
        const centerX = left + width / 2;
        const centerY = top + height / 2;
        const cw = canvas.width!;
        const ch = canvas.height!;

        const SNAP_DIST = 8;
        const snapTargets = [
            { x: 0, label: 'left' },
            { x: cw / 2, label: 'center-h' },
            { x: cw, label: 'right' },
        ];
        const snapTargetsY = [
            { y: 0, label: 'top' },
            { y: ch / 2, label: 'center-v' },
            { y: ch, label: 'bottom' },
        ];

        guidelines = [];

        let snapX: number | null = null;
        let snapY: number | null = null;

        // Check horizontal snaps
        const xChecks = [
            { point: left, refs: snapTargets },
            { point: centerX, refs: snapTargets },
            { point: right, refs: snapTargets },
        ];
        for (const check of xChecks) {
            for (const target of check.refs) {
                if (Math.abs(check.point - target.x) < SNAP_DIST) {
                    const dx = target.x - check.point;
                    obj.left = (obj.left || 0) + dx;
                    obj.setCoords();
                    guidelines.push({ v: target.x, h: -1 });
                    snapX = target.x;
                    break;
                }
            }
            if (snapX !== null) break;
        }

        // Check vertical snaps
        const yChecks = [
            { point: top, refs: snapTargetsY },
            { point: centerY, refs: snapTargetsY },
            { point: bottom, refs: snapTargetsY },
        ];
        for (const check of yChecks) {
            for (const target of check.refs) {
                if (Math.abs(check.point - target.y) < SNAP_DIST) {
                    const dy = target.y - check.point;
                    obj.top = (obj.top || 0) + dy;
                    obj.setCoords();
                    guidelines.push({ v: -1, h: target.y });
                    snapY = target.y;
                    break;
                }
            }
            if (snapY !== null) break;
        }
    });

    canvas.on('after:render', () => {
        if (guidelines.length === 0) return;
        const ctx = canvas.getContext();
        ctx.save();
        ctx.strokeStyle = 'var(--primary)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        for (const g of guidelines) {
            if (g.v >= 0) {
                ctx.beginPath();
                ctx.moveTo(g.v, 0);
                ctx.lineTo(g.v, canvas.height!);
                ctx.stroke();
            }
            if (g.h >= 0) {
                ctx.beginPath();
                ctx.moveTo(0, g.h);
                ctx.lineTo(canvas.width!, g.h);
                ctx.stroke();
            }
        }
        ctx.restore();
    });

    canvas.on('mouse:up', () => {
         guidelines = [];
         canvas.requestRenderAll();
    });
    
    // Initial Save
    if (history.length === 0) saveHistory();

    const handleKeyDown = (e: KeyboardEvent) => {
        // Ignore if user is typing in an input or editing text layer
        const target = e.target as HTMLElement;
        if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return;
        
        // Undo / Redo Shortcuts (GLOBAL)
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            undo();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault();
            redo();
            return;
        }

        const activeObj = canvas.getActiveObject();
        // Check if user is editing text inside canvas
        if (activeObj instanceof fabric.IText && activeObj.isEditing) return;

        if (!activeObj) return;

        // Delete / Backspace
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            canvas.remove(activeObj);
            canvas.requestRenderAll();
        }

        // Arrow Keys (Nudge)
        const STEP = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeObj.set('top', (activeObj.top || 0) - STEP);
            activeObj.setCoords();
            canvas.requestRenderAll();
            saveHistory();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeObj.set('top', (activeObj.top || 0) + STEP);
            activeObj.setCoords();
            canvas.requestRenderAll();
            saveHistory();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            activeObj.set('left', (activeObj.left || 0) - STEP);
            activeObj.setCoords();
            canvas.requestRenderAll();
            saveHistory();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            activeObj.set('left', (activeObj.left || 0) + STEP);
            activeObj.setCoords();
            canvas.requestRenderAll();
            saveHistory();
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      canvas.off('object:modified', onModify);
      canvas.off('object:added', onModify);
      canvas.off('object:removed', onModify);
      canvas.off('object:moving');
      canvas.off('after:render');
      canvas.off('mouse:up');
    };
  }, [canvas, history, historyIndex]); // Added dependencies for Undo/Redo closure
  useEffect(() => {
      if (canvas && canvas.backgroundColor !== bgColor) {
          canvas.backgroundColor = bgColor;
          canvas.requestRenderAll();
      }
  }, [bgColor, canvas]);


  // HELPER FUNCTIONS
  const addImage = (url: string, name: string) => {
    if (!canvas) return;
    
    // v6 compatible center
    const center = { left: canvas.width / 2, top: canvas.height / 2 };

    fabric.FabricImage.fromURL(url).then((img) => {
        if (!img) return;

        const maxSize = Math.min(canvas.width, canvas.height) * 0.5;
        if (img.width! > maxSize || img.height! > maxSize) {
            const scaleFactor = maxSize / Math.max(img.width!, img.height!);
            img.scale(scaleFactor);
        }

        img.set({
            left: center.left,
            top: center.top,
            originX: 'center',
            originY: 'center',
            cornerColor: 'var(--primary)',
            cornerStyle: 'circle',
            transparentCorners: false,
            datasetName: name
        });
        
        canvas.add(img);
        canvas.setActiveObject(img);
        updateLayers();
    });
  };

  const addText = () => {
      if (!canvas) return;
      const center = { left: canvas.width / 2, top: canvas.height / 2 };
      
      const text = new fabric.IText('Texto', {
          left: center.left,
          top: center.top,
          originX: 'center',
          originY: 'center',
          fontFamily: 'sans-serif',
          fontSize: 60,
          fill: '#1a1714',
          cornerColor: 'var(--primary)',
          cornerStyle: 'circle',
          transparentCorners: false
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      updateLayers();
  };

  const deleteSelected = () => {
      if (!canvas) return;
      const activeParam = canvas.getActiveObjects();
      if (activeParam.length) {
          canvas.discardActiveObject();
          activeParam.forEach((obj) => {
              canvas.remove(obj);
          });
          updateLayers();
      }
  };
  
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const url = URL.createObjectURL(file);
      setCustomAssets(prev => [...prev, { url, name: file.name }]);
      
      e.target.value = '';
  };
  
  const removeCustomAsset = (index: number) => {
      setCustomAssets(prev => prev.filter((_, i) => i !== index));
  };
  
  // Keyboard Delete
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Delete' && canvas) {
            deleteSelected();
        }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [canvas]);


  const alignSelected = (direction: 'left' | 'center-h' | 'right' | 'center-v') => {
      if (!canvas) return;
      const active = canvas.getActiveObject();
      if (!active) return;

      const canvasWidth = canvas.width!;
      const canvasHeight = canvas.height!;
      const objBounds = active.getBoundingRect();

      switch (direction) {
          case 'left':
              active.set('left', String(active.originX) === 'center' ? objBounds.width / 2 : 0);
              break;
          case 'center-h':
              active.setPositionByOrigin(new fabric.Point(canvasWidth / 2, objBounds.top + objBounds.height / 2), 'center', 'center');
              break;
          case 'right':
              active.set('left', canvasWidth - (String(active.originX) === 'center' ? objBounds.width / 2 : objBounds.width));
              break;
          case 'center-v':
              active.setPositionByOrigin(new fabric.Point(objBounds.left + objBounds.width / 2, canvasHeight / 2), 'center', 'center');
              break;
      }
      active.setCoords();
      canvas.requestRenderAll();
      saveHistory();
  };

  const distributeSelected = () => {
      if (!canvas) return;
      const activeObjects = canvas.getActiveObjects();
      if (activeObjects.length < 3) return;

      // Sort by left position
      const sorted = [...activeObjects].sort((a, b) => (a.left || 0) - (b.left || 0));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalSpace = (last.left || 0) - (first.left || 0);
      const gap = totalSpace / (sorted.length - 1);

      sorted.forEach((obj, i) => {
          obj.set('left', (first.left || 0) + gap * i);
          obj.setCoords();
      });
      canvas.requestRenderAll();
      saveHistory();
  };

  const downloadCanvas = () => {
      if (!canvas) return;
      
      const dataURL = canvas.toDataURL({
          format: exportFormat,
          quality: quality,
          enableRetinaScaling: true,
          multiplier: 2
      });
      
      const link = document.createElement('a');
      link.href = dataURL;
      link.download = `compo-smart-asset.${exportFormat}`;
      link.click();
  };
  
  const resizeCanvas = (w: number, h: number) => {
      const clampedW = Math.max(50, Math.min(10000, isNaN(w) ? canvasWidth : w));
      const clampedH = Math.max(50, Math.min(10000, isNaN(h) ? canvasHeight : h));
      setCanvasWidth(clampedW);
      setCanvasHeight(clampedH);
  };

  return (
    <div className={styles.container}>
      {/* LEFT SIDEBAR */}
      {!focusMode && <div className={styles.sidebar}>
         <div className={styles.sidebarHeader} style={{justifyContent:'space-between'}}>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
                <ImageIcon size={16} />
                <span>Mis Activos</span>
            </div>
            <button 
                onClick={() => fileInputRef.current?.click()} 
                style={{background:'transparent', border:'none', color:'var(--primary)', cursor:'pointer', display:'flex', alignItems:'center', padding:4, borderRadius:4}}
                title="Importar imagen externa"
            >
                 <Upload size={16} />
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                style={{display:'none'}} 
                accept="image/*" 
                onChange={handleImportFile} 
            />
         </div>

         <div style={{padding:'10px', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-panel)'}}>
             <p style={{fontSize:'10px', color:'var(--text-dim)', marginBottom:6, fontWeight:600, letterSpacing:0.5}}>TAMAÑO LIENZO</p>
             
             {/* Presets */}
             <div style={{display:'flex', gap:4, marginBottom:8}}>
                 <button onClick={() => resizeCanvas(1080, 1080)} className={styles.miniBtn} title="Post Cuadrado (1:1)" style={{flex:1, justifyContent:'center'}}>
                    <Square size={14} />
                 </button>
                 <button onClick={() => resizeCanvas(1080, 1920)} className={styles.miniBtn} title="Historia (9:16)" style={{flex:1, justifyContent:'center'}}>
                    <Smartphone size={14} />
                 </button>
                 <button onClick={() => resizeCanvas(1920, 1080)} className={styles.miniBtn} title="Full HD (16:9)" style={{flex:1, justifyContent:'center'}}>
                    <Monitor size={14} />
                 </button>
             </div>

             <div style={{display:'flex', gap:8, alignItems:'center'}}>
                     <input 
                        className={styles.input} 
                        type="number" 
                        value={canvasWidth} 
                        style={{width:'100%', background:'var(--bg-card)', border:'1px solid var(--border-active)', color:'var(--text-main)', padding:'4px', borderRadius:4, fontSize:12}}
                        onChange={(e) => resizeCanvas(Number(e.target.value), canvasHeight)} 
                     />
                     <span style={{color:'var(--text-subtle)', fontSize:12}}>x</span>
              <input 
                         className={styles.input} 
                         type="number" 
                         value={canvasHeight}
                         style={{width:'100%', background:'var(--bg-card)', border:'1px solid var(--border-active)', color:'var(--text-main)', padding:'4px', borderRadius:4, fontSize:12}}
                         onChange={(e) => resizeCanvas(canvasWidth, Number(e.target.value))} 
                      />
              </div>

              {/* Template Presets */}
              <div style={{marginTop: 10}}>
                  <button
                      onClick={() => setShowTemplates(!showTemplates)}
                      style={{
                          width:'100%', background:'transparent', border:'1px solid var(--border-subtle)',
                          color:'var(--text-muted)', padding:'6px 8px', borderRadius:6,
                          cursor:'pointer', fontFamily:'inherit', fontSize:11,
                          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                          transition:'all 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                      <LayoutTemplate size={14} />
                      {showTemplates ? 'Ocultar plantillas' : 'Plantillas E-commerce'}
                  </button>
                  
                  {showTemplates && (
                      <div style={{marginTop: 8, display:'flex', flexDirection:'column', gap: 4}}>
                          {TEMPLATES.map((t, i) => (
                              <button
                                  key={i}
                                  onClick={() => {
                                      resizeCanvas(t.width, t.height);
                                      setBgColor(t.bg);
                                      setShowTemplates(false);
                                  }}
                                  style={{
                                      display:'flex', alignItems:'center', justifyContent:'space-between',
                                      padding:'6px 8px', borderRadius:6,
                                      background:'transparent', border:'1px solid var(--border-subtle)',
                                      color:'var(--text-muted)', cursor:'pointer', fontFamily:'inherit',
                                      fontSize:11, transition:'all 0.15s',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                              >
                                  <span style={{fontWeight: 600}}>{t.name}</span>
                                  <span style={{fontSize: 10, opacity: 0.6}}>{t.width}×{t.height}</span>
                              </button>
                          ))}
                      </div>
                  )}
              </div>
          </div>

          <div className={styles.assetList}>
            {(assets.length === 0 && customAssets.length === 0) && <p style={{color:'var(--text-dim)', fontSize:'12px', padding:'10px', textAlign:'center'}}>Sin Activos</p>}
            
            {/* Standard Assets */}
            {assets.map((asset) => (
               <div 
                 key={asset.id} 
                 className={styles.assetItem}
                 onClick={() => addImage(asset.processedUrl, asset.fileName)} 
                 title={`Añadir ${asset.fileName}`}
               >
                  <img src={asset.processedUrl} className={styles.assetImg} />
                  
                  {/* Delete Button */}
                  <div 
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onDeleteAsset) onDeleteAsset(asset.id);
                    }}
                    className={styles.deleteOverlay}
                  >
                      <X size={14} color="white" />
                  </div>

                  <span style={{position:'absolute', bottom:0, background:'rgba(0,0,0,0.7)', color:'var(--text-main)', fontSize:9, width:'100%', padding:'2px 4px', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis'}}>
                     {asset.fileName}
                  </span>
               </div>
            ))}

            {/* Custom Assets */}
            {customAssets.map((asset, i) => (
               <div 
                 key={`custom-${i}`} 
                 className={styles.assetItem}
                 onClick={() => addImage(asset.url, asset.name)} 
                 title={`Añadir ${asset.name}`}
               >
                  <img src={asset.url} className={styles.assetImg} />
                  
                  {/* Delete Button Custom */}
                  <div 
                    onClick={(e) => {
                        e.stopPropagation();
                        removeCustomAsset(i);
                    }}
                    className={styles.deleteOverlay}
                  >
                      <X size={14} color="white" />
                  </div>

                  <span style={{position:'absolute', bottom:0, background:'rgba(0,0,0,0.7)', color:'var(--text-main)', fontSize:9, width:'100%', padding:'2px 4px', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis'}}>
                     {asset.name}
                  </span>
               </div>
            ))}
         </div>
      </div>}

      {/* CENTER CANVAS */}
      <div 
        className={styles.canvasArea} 
        ref={containerRef} 
        style={{ display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', background:'var(--bg-deep)', position: 'relative' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
            e.preventDefault();
            const droppedFiles = Array.from(e.dataTransfer.files);
            // Filter images
            const imageFiles = droppedFiles.filter(f => f.type.startsWith('image/'));
            
            if (imageFiles.length > 0) {
                imageFiles.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = (f) => {
                        if (f.target?.result) {
                             addImage(f.target.result as string, file.name);
                        }
                    };
                    reader.readAsDataURL(file);
                });
            }
        }}
      >
         
         {/* FLOATING TOOLBAR */}
         <div className={styles.canvasOverlay}>
            <button className={styles.toolBtn} onClick={addText} title="Añadir Texto">
                <Type size={20} />
            </button>
            <div className={styles.dividerVertical}></div>
            <button className={styles.toolBtn} onClick={() => fileInputRef.current?.click()} title="Subir Imagen">
                <Upload size={20} />
            </button>
            <div className={styles.dividerVertical}></div>
            {/* Alignment Tools */}
            <button className={styles.toolBtn} onClick={() => alignSelected('left')} title="Alinear izquierda" disabled={!selectedObject}>
                <AlignLeft size={18} />
            </button>
            <button className={styles.toolBtn} onClick={() => alignSelected('center-h')} title="Alinear centro horizontal" disabled={!selectedObject}>
                <AlignHorizontalJustifyCenter size={18} />
            </button>
            <button className={styles.toolBtn} onClick={() => alignSelected('right')} title="Alinear derecha" disabled={!selectedObject}>
                <AlignRight size={18} />
            </button>
            <button className={styles.toolBtn} onClick={() => alignSelected('center-v')} title="Alinear centro vertical" disabled={!selectedObject}>
                <AlignVerticalJustifyCenter size={18} />
            </button>
            <div className={styles.dividerVertical}></div>
            <button className={styles.toolBtn} onClick={distributeSelected} title="Distribuir uniformemente" disabled={!selectedObject}>
                <LayoutTemplate size={18} />
            </button>
         </div>
         
         <div 
            style={{ 
                width: 0,
                height: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'visible' 
            }}
         >
             <div 
                className={styles.canvasWrapper} 
                style={{ 
                    width: canvasWidth, 
                    height: canvasHeight,
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    boxShadow: '0 0 100px rgba(0,0,0,0.5)',
                    border: '1px solid var(--border-subtle)',
                    background: bgColor, 
                    flexShrink: 0
                }}
             >
                 <canvas ref={canvasRef} />
             </div>
         </div>
         
         <div style={{
              position:'absolute', 
              top: 20, 
              left: '50%', 
              transform:'translateX(-50%)',
              background:'rgba(0,0,0,0.6)', 
              padding:'4px 12px', 
              borderRadius:20, 
              fontSize:11, 
              color:'var(--text-muted)',
              pointerEvents:'none'
          }}>
              Vista: {Math.round(scale * 100)}%
          </div>
      </div>

      {/* RIGHT PANEL - PROPERTIES & LAYERS */}
      {!focusMode && <div className={styles.propertiesPanel}>
          <div className={styles.tabs}>
              <button 
                  className={`${styles.tab} ${activeTab === 'properties' ? styles.active : ''}`}
                  onClick={() => setActiveTab('properties')}
              >
                  Propiedades
              </button>
              <button 
                  className={`${styles.tab} ${activeTab === 'layers' ? styles.active : ''}`}
                  onClick={() => setActiveTab('layers')}
              >
                  Capas ({layers.length})
              </button>
          </div>

          <div className={styles.panelContent}>
              {activeTab === 'properties' ? (
                  <>
                      {selectedObject ? (
                          <div style={{display:'flex', flexDirection:'column', gap:16}}>
                              
                              {/* Common: Opacity */}
                              <div>
                                  <div className={styles.controlLabel}>Opacidad</div>
                                  <input 
                                      type="range" 
                                      min="0" max="1" step="0.01"
                                      value={selectedObject.opacity || 1} 
                                      onChange={(e) => {
                                          selectedObject.set('opacity', parseFloat(e.target.value));
                                          canvas?.requestRenderAll();
                                          forceUpdate(n => n + 1);
                                      }}
                                      style={{width:'100%'}}
                                  />
                              </div>

                              {/* Text Specific */}
                              {(selectedObject instanceof fabric.IText) && (
                                  <>
                                    <div className={styles.divider}></div>
                                    <div className={styles.controlLabel}>Texto</div>
                                    
                                    {/* Color */}
                                    <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                                        <div style={{width: 30, height: 30, borderRadius: 4, background: selectedObject.fill as string, border:'1px solid var(--border-active)', overflow:'hidden', position:'relative'}}>
                                            <input 
                                                type="color" 
                                                value={selectedObject.fill as string} 
                                                onChange={(e) => {
                                                    selectedObject.set('fill', e.target.value);
                                                    canvas?.requestRenderAll();
                                                }}
                                                style={{width:'100%', height:'100%', opacity:0, cursor:'pointer', position:'absolute', top:0, left:0}}
                                            />
                                        </div>
                                        <span style={{fontSize:12, color:'var(--text-muted)'}}>Color</span>
                                    </div>

                                    {/* Style Buttons */}
                                    <div style={{display:'flex', gap:4, background:'var(--bg-card)', padding:4, borderRadius:6}}>
                                        <button 
                                            className={`${styles.miniBtn} ${(selectedObject.fontWeight === 'bold') ? styles.activeBtn : ''}`}
                                            onClick={() => {
                                                const isBold = selectedObject.fontWeight === 'bold';
                                                selectedObject.set('fontWeight', isBold ? 'normal' : 'bold');
                                                canvas?.requestRenderAll();
                                            }}
                                            title="Negrita"
                                        >
                                            <Bold size={14} />
                                        </button>
                                        <button 
                                            className={`${styles.miniBtn} ${(selectedObject.fontStyle === 'italic') ? styles.activeBtn : ''}`}
                                            onClick={() => {
                                                const isItalic = selectedObject.fontStyle === 'italic';
                                                selectedObject.set('fontStyle', isItalic ? 'normal' : 'italic');
                                                canvas?.requestRenderAll();
                                            }}
                                            title="Cursiva"
                                        >
                                            <Italic size={14} />
                                        </button>
                                        <div style={{width:1, background:'var(--border-active)', margin:'0 4px'}}></div>
                                         <button 
                                            className={styles.miniBtn}
                                            onClick={() => { selectedObject.set('textAlign', 'left'); canvas?.requestRenderAll(); }}
                                        >
                                            <AlignLeft size={14} />
                                        </button>
                                        <button 
                                            className={styles.miniBtn}
                                            onClick={() => { selectedObject.set('textAlign', 'center'); canvas?.requestRenderAll(); }}
                                        >
                                            <AlignCenter size={14} />
                                        </button>
                                         <button 
                                            className={styles.miniBtn}
                                            onClick={() => { selectedObject.set('textAlign', 'right'); canvas?.requestRenderAll(); }}
                                        >
                                            <AlignRight size={14} />
                                        </button>
                                    </div>

                                    {/* Font Family Simple Selector */}
                                    <div style={{marginTop:8}}>
                                        <select 
                                            value={selectedObject.fontFamily}
                                            onChange={(e) => { selectedObject.set('fontFamily', e.target.value); canvas?.requestRenderAll(); }}
                                            style={{width:'100%', background:'var(--bg-card)', color:'var(--text-main)', border:'1px solid var(--border-active)', padding:4, borderRadius:4, fontSize:12, cursor:'pointer'}}
                                        >
                                            <option value="sans-serif">Sans Serif</option>
                                            <option value="serif">Serif</option>
                                            <option value="monospace">Monospace</option>
                                            <option value="cursive">Cursiva</option>
                                            <option value="fantasy">Impact</option>
                                        </select>
                                    </div>
                                  </>
                              )}


                              {/* Image Specific */}
                              {(selectedObject instanceof fabric.Image) && (
                                  <>
                                    <div className={styles.divider}></div>
                                    <div className={styles.controlLabel}>Imagen</div>
                                    
                                    {/* Brightness */}
                                    <div style={{marginBottom:8}}>
                                        <div style={{display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-muted)', marginBottom:4}}>
                                            <span>Brillo</span>
                                            <span>{((selectedObject.filters?.find(f => f.type === 'Brightness') as any)?.brightness || 0).toFixed(2)}</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="-1" max="1" step="0.05"
                                            value={(selectedObject.filters?.find(f => f.type === 'Brightness') as any)?.brightness || 0}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                // Find or add filter
                                                const idx = selectedObject.filters?.findIndex(f => f.type === 'Brightness');
                                                if (idx !== undefined && idx > -1) {
                                                    (selectedObject.filters![idx] as any).brightness = val;
                                                } else {
                                                    selectedObject.filters?.push(new fabric.filters.Brightness({ brightness: val }));
                                                }
                                                selectedObject.applyFilters();
                                                canvas?.requestRenderAll();
                                                forceUpdate(n => n + 1);
                                            }}
                                            style={{width:'100%'}}
                                        />
                                    </div>

                                    {/* Contrast */}
                                    <div style={{marginBottom:8}}>
                                        <div style={{display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-muted)', marginBottom:4}}>
                                            <span>Contraste</span>
                                            <span>{((selectedObject.filters?.find(f => f.type === 'Contrast') as any)?.contrast || 0).toFixed(2)}</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="-1" max="1" step="0.05"
                                            value={(selectedObject.filters?.find(f => f.type === 'Contrast') as any)?.contrast || 0}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                const idx = selectedObject.filters?.findIndex(f => f.type === 'Contrast');
                                                if (idx !== undefined && idx > -1) {
                                                    (selectedObject.filters![idx] as any).contrast = val;
                                                } else {
                                                    selectedObject.filters?.push(new fabric.filters.Contrast({ contrast: val }));
                                                }
                                                selectedObject.applyFilters();
                                                canvas?.requestRenderAll();
                                                forceUpdate(n => n + 1);
                                            }}
                                            style={{width:'100%'}}
                                        />
                                    </div>

                                    {/* Saturation */}
                                    <div style={{marginBottom:8}}>
                                        <div style={{display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-muted)', marginBottom:4}}>
                                            <span>Saturación</span>
                                            <span>{((selectedObject.filters?.find(f => f.type === 'Saturation') as any)?.saturation || 0).toFixed(2)}</span>
                                        </div>
                                        <input 
                                            type="range" min="-1" max="1" step="0.05"
                                            value={(selectedObject.filters?.find(f => f.type === 'Saturation') as any)?.saturation || 0}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                const idx = selectedObject.filters?.findIndex(f => f.type === 'Saturation');
                                                if (idx !== undefined && idx > -1) {
                                                    (selectedObject.filters![idx] as any).saturation = val;
                                                } else {
                                                    selectedObject.filters?.push(new (fabric.filters as any).Saturation({ saturation: val }));
                                                }
                                                selectedObject.applyFilters();
                                                canvas?.requestRenderAll();
                                                forceUpdate(n => n + 1);
                                            }}
                                            style={{width:'100%'}}
                                        />
                                    </div>

                                    <div className={styles.divider}></div>
                                    
                                    {/* Blend Mode */}
                                    <div style={{marginBottom: 12}}>
                                        <div className={styles.controlLabel} style={{marginBottom: 6}}>Modo Mezcla</div>
                                        <select 
                                            value={(selectedObject as any).blendMode || 'normal'}
                                            onChange={(e) => {
                                                selectedObject.set('blendMode' as any, e.target.value);
                                                canvas?.requestRenderAll();
                                                forceUpdate(n => n + 1);
                                            }}
                                            style={{
                                                width:'100%', background:'var(--bg-card)', color:'var(--text-main)',
                                                border:'1px solid var(--border-active)', padding:'6px 8px',
                                                borderRadius:6, fontSize:12, cursor:'pointer', fontFamily:'inherit',
                                            }}
                                        >
                                            {BLEND_MODES.map(mode => (
                                                <option key={mode} value={mode}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div className={styles.divider}></div>
                                    
                                    {/* Shadow Toggle */}
                                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
                                        <div className={styles.controlLabel} style={{marginBottom:0}}>Sombra</div>
                                        <button 
                                            className={`${styles.miniBtn} ${selectedObject.shadow ? styles.activeBtn : ''}`}
                                            onClick={() => {
                                                if (selectedObject.shadow) {
                                                    selectedObject.set('shadow', null);
                                                } else {
                                                    selectedObject.set('shadow', new fabric.Shadow({ color: 'rgba(0,0,0,0.5)', blur: 20, offsetX: 10, offsetY: 10 }));
                                                }
                                                canvas?.requestRenderAll();
                                                forceUpdate(n => n + 1);
                                            }}
                                        >
                                           <Layers size={14} />
                                        </button>
                                    </div>
                                    
                                    {/* Shadow Controls (only if enabled) */}
                                    {selectedObject.shadow && (
                                        <div style={{paddingLeft:8, borderLeft:'2px solid var(--border-subtle)'}}>
                                            <div style={{fontSize:10, color:'var(--text-muted)', marginBottom:2}}>Blur</div>
                                            <input 
                                                type="range" min="0" max="100" 
                                                value={(selectedObject.shadow as fabric.Shadow).blur}
                                                onChange={(e) => {
                                                    (selectedObject.shadow as fabric.Shadow).blur = Number(e.target.value);
                                                    canvas?.requestRenderAll();
                                                    forceUpdate(n => n + 1);
                                                }}
                                                style={{width:'100%', marginBottom:4}}
                                            />
                                            <div style={{fontSize:10, color:'var(--text-muted)', marginBottom:2}}>Distancia</div>
                                             <input 
                                                type="range" min="-50" max="50" 
                                                value={(selectedObject.shadow as fabric.Shadow).offsetX}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    (selectedObject.shadow as fabric.Shadow).offsetX = val;
                                                    (selectedObject.shadow as fabric.Shadow).offsetY = val;
                                                    canvas?.requestRenderAll();
                                                    forceUpdate(n => n + 1);
                                                }}
                                                style={{width:'100%'}}
                                            />
                                        </div>
                                    )}

                                  </>
                              )}
                          </div>
                      ) : (
                          <p style={{color:'var(--text-dim)', fontSize:12, textAlign:'center', marginTop:20}}>Selecciona un objeto para editar.</p>
                      )}

                      <div className={styles.divider} style={{margin:'20px 0', borderTop:'1px solid var(--border-subtle)'}}></div>
                      
                      <div className={styles.controlLabel} style={{marginBottom:8}}>Color Fondo</div>
                      <div style={{display:'flex', gap:8}}>
                          <input 
                              type="color" 
                              value={bgColor}
                              onChange={(e) => setBgColor(e.target.value)}
                              className={styles.colorPicker}
                          />
                          <input 
                              type="text" 
                              value={bgColor}
                              onChange={(e) => setBgColor(e.target.value)}
                              style={{background:'var(--bg-card)', border:'1px solid var(--border-active)', color:'var(--text-muted)', width:'100%', borderRadius:4, padding:'0 8px'}}
                          />
                      </div>
                  </>
              ) : (
                  <div className={styles.layerList}>
                      {layers.map((obj, index) => (
                          <div 
                              key={index} 
                              className={`${styles.layerItem} ${obj === selectedObject ? styles.active : ''}`}
                              onClick={() => {
                                  canvas?.setActiveObject(obj);
                                  canvas?.requestRenderAll();
                              }}
                              draggable
                              onDragStart={() => setDraggedLayerIndex(index)}
                              onDragOver={(e) => { e.preventDefault(); }}
                              onDrop={(e) => {
                                  e.preventDefault();
                                  if (draggedLayerIndex !== null && canvas) {
                                      const objToMove = layers[draggedLayerIndex];
                                      // Fabric v6 reorder
                                      const targetIndex = layers.length - 1 - index;
                                      
                                      // Check if method exists (it should in v6 beta+ but safe check)
                                      if (canvas.moveObjectTo) {
                                          canvas.moveObjectTo(objToMove, targetIndex);
                                      } else {
                                          // Fallback or ignore
                                      }
                                      
                                      canvas.requestRenderAll();
                                      updateLayers();
                                  }
                              }}
                          >
                               <div className={styles.layerPreview} style={{background: obj instanceof fabric.IText ? 'var(--text-muted)' : 'var(--bg-deep)'}}>
                                   {/* Preview icon */}
                              </div>
                               <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                                   {(obj as any).datasetName || (obj.type === 'i-text' ? (obj as any).text : obj.type)}
                               </span>
                              <div className={styles.layerActions}>
                                  <button className={styles.miniBtn} onClick={(e) => {
                                      e.stopPropagation();
                                      obj.visible = !obj.visible;
                                      obj.dirty = true;
                                      canvas?.requestRenderAll();
                                      updateLayers();
                                  }}>
                                      <Eye size={12} color={obj.visible ? 'var(--text-muted)' : 'var(--text-subtle)'} />
                                  </button>
                                  <button className={styles.miniBtn} onClick={(e) => {
                                      e.stopPropagation();
                                      const newLockState = !obj.lockMovementX;
                                      obj.lockMovementX = newLockState;
                                      obj.lockMovementY = newLockState;
                                      canvas?.discardActiveObject();
                                      canvas?.requestRenderAll();
                                      updateLayers();
                                  }}>
                                      <Lock size={12} color={obj.lockMovementX ? 'var(--accent-gold)' : 'var(--text-muted)'} />
                                  </button>
                                  <button className={styles.miniBtn} onClick={(e) => {
                                      e.stopPropagation();
                                      canvas?.remove(obj);
                                      updateLayers();
                                  }}>
                                      <Trash size={12} />
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
        
              <div style={{marginTop:'auto'}}>
                 <button className={styles.exportBtn} onClick={downloadCanvas}>
                    <Download size={16} /> Exportar Diseño ({exportFormat.toUpperCase()})
                 </button>
              </div>

          </div>
      </div>}
    </div>
  );
}
