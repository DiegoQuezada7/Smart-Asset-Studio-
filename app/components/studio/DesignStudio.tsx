"use client";

import { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric'; 
import { Download, Type, Image as ImageIcon, Layers, Move, Trash, Square, ChevronUp, ChevronDown, Eye, Lock, Upload, X, Bold, Italic, AlignCenter, AlignLeft, AlignRight, Smartphone, Monitor } from 'lucide-react';
import styles from './DesignStudio.module.css';
import { ProcessedResult } from '../../hooks/useImageProcessor';
import { useLocalStorage } from '../../hooks/useLocalStorage';

interface DesignStudioProps {
  assets?: ProcessedResult[]; 
  onBack?: () => void;        
  exportFormat: 'png' | 'webp' | 'jpeg';
  quality: number;
  onDeleteAsset?: (id: string) => void;
}

export default function DesignStudio({ assets = [], onBack, exportFormat, quality, onDeleteAsset }: DesignStudioProps) {
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
    canvas.on('object:added', onModify);
    canvas.on('object:removed', onModify);
    
    // SMART GUIDES (Snapping)
    let guidelines = { v: false, h: false };

    canvas.on('object:moving', (e) => {
        const obj = e.target;
        if (!obj || !canvas) return;

        const w = obj.width! * obj.scaleX!;
        const h = obj.height! * obj.scaleY!;
        const centerX = obj.left! + w / 2; // For originX technically depends but lets assume center for now or adjust
        // Simplify: assume origin is center for now (as we set it in addImage) or calculate based on origin.
        // Actually DesignStudio sets originX/Y to center for images. Text is default (left/top). 
        // We will snap based on the object's current generic center point.
        const centerPoint = obj.getCenterPoint();

        const canvasCenter = { x: canvas.width! / 2, y: canvas.height! / 2 };
        const SNAP_DIST = 10;

        guidelines.v = false;
        guidelines.h = false;

        // Snap Vertical (Center X)
        if (Math.abs(centerPoint.x - canvasCenter.x) < SNAP_DIST) {
            obj.setPositionByOrigin(new fabric.Point(canvasCenter.x, centerPoint.y), 'center', 'center');
            guidelines.v = true;
        }

        // Snap Horizontal (Center Y)
        if (Math.abs(centerPoint.y - canvasCenter.y) < SNAP_DIST) {
            obj.setPositionByOrigin(new fabric.Point(centerPoint.x || obj.getCenterPoint().x, canvasCenter.y), 'center', 'center');
            guidelines.h = true;
        }
    });

    canvas.on('after:render', () => {
        if (!guidelines.v && !guidelines.h) return;
        
        const ctx = canvas.getContext();
        ctx.save();
        ctx.strokeStyle = '#ff0077';
        ctx.lineWidth = 1;

        if (guidelines.v) {
            ctx.beginPath();
            ctx.moveTo(canvas.width! / 2, 0);
            ctx.lineTo(canvas.width! / 2, canvas.height!);
            ctx.stroke();
        }

        if (guidelines.h) {
             ctx.beginPath();
             ctx.moveTo(0, canvas.height! / 2);
             ctx.lineTo(canvas.width!, canvas.height! / 2);
             ctx.stroke();
        }
        
        ctx.restore();
    });

    canvas.on('mouse:up', () => {
         guidelines = { v: false, h: false };
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

        // Delete / Backspace
        if (e.key === 'Delete' || e.key === 'Backspace') {
            // ... (original delete logic) ...
            e.preventDefault();
            canvas.remove(activeObj);
            canvas.requestRenderAll();
            // Trigger layer update Manually since 'object:removed' might fire async or we want instant feedback
            // Note: object:removed event will trigger saveHistory via listener
        }
        
        // Undo / Redo Shortcuts
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

        // Arrow Keys (Nudge)
        const STEP = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeObj.set('top', (activeObj.top || 0) - STEP);
            // ...
            activeObj.setCoords();
            canvas.requestRenderAll();
            saveHistory(); // Explicit save for nudges as modified might not fire on programmatic set
        } else if (e.key === 'ArrowDown') {
             // ...
            e.preventDefault();
            activeObj.set('top', (activeObj.top || 0) + STEP);
            activeObj.setCoords();
            canvas.requestRenderAll();
            saveHistory();
        } else if (e.key === 'ArrowLeft') {
             // ...
             e.preventDefault();
             activeObj.set('left', (activeObj.left || 0) - STEP);
             activeObj.setCoords();
             canvas.requestRenderAll();
             saveHistory();
        } else if (e.key === 'ArrowRight') {
             // ...
             e.preventDefault();
             activeObj.set('left', (activeObj.left || 0) + STEP);
             activeObj.setCoords();
             canvas.requestRenderAll();
             saveHistory();
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
            cornerColor: '#6366f1',
            cornerStyle: 'circle',
            transparentCorners: false,
            // @ts-ignore custom prop
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
          fill: '#000000',
          cornerColor: '#6366f1',
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
      setCanvasWidth(w);
      setCanvasHeight(h);
  };

  return (
    <div className={styles.container}>
      {/* LEFT SIDEBAR */}
      <div className={styles.sidebar}>
         <div className={styles.sidebarHeader} style={{justifyContent:'space-between'}}>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
                <ImageIcon size={16} />
                <span>Mis Activos</span>
            </div>
            <button 
                onClick={() => fileInputRef.current?.click()} 
                style={{background:'transparent', border:'none', color:'#6366f1', cursor:'pointer', display:'flex', alignItems:'center', padding:4, borderRadius:4}}
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

         <div style={{padding:'10px', borderBottom:'1px solid #27272a', background:'#18181b'}}>
             <p style={{fontSize:'10px', color:'#71717a', marginBottom:6, fontWeight:600, letterSpacing:0.5}}>TAMAÑO LIENZO</p>
             
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
                    style={{width:'100%', background:'#27272a', border:'1px solid #3f3f46', color:'white', padding:'4px', borderRadius:4, fontSize:12}}
                    onChange={(e) => resizeCanvas(Number(e.target.value), canvasHeight)} 
                 />
                 <span style={{color:'#52525b', fontSize:12}}>x</span>
                 <input 
                    className={styles.input} 
                    type="number" 
                    value={canvasHeight}
                    style={{width:'100%', background:'#27272a', border:'1px solid #3f3f46', color:'white', padding:'4px', borderRadius:4, fontSize:12}}
                    onChange={(e) => resizeCanvas(canvasWidth, Number(e.target.value))} 
                 />
             </div>
         </div>

         <div className={styles.assetList}>
            {(assets.length === 0 && customAssets.length === 0) && <p style={{color:'#666', fontSize:'12px', padding:'10px', textAlign:'center'}}>Sin Activos</p>}
            
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

                  <span style={{position:'absolute', bottom:0, background:'rgba(0,0,0,0.7)', color:'white', fontSize:9, width:'100%', padding:'2px 4px', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis'}}>
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

                  <span style={{position:'absolute', bottom:0, background:'rgba(0,0,0,0.7)', color:'white', fontSize:9, width:'100%', padding:'2px 4px', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis'}}>
                     {asset.name}
                  </span>
               </div>
            ))}
         </div>
      </div>

      {/* CENTER CANVAS */}
      <div 
        className={styles.canvasArea} 
        ref={containerRef} 
        style={{ display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', background:'#09090b', position: 'relative' }}
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
                    border: '1px solid #333',
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
              color:'#aaa',
              pointerEvents:'none'
          }}>
              Vista: {Math.round(scale * 100)}%
          </div>
      </div>

      {/* RIGHT PANEL - PROPERTIES & LAYERS */}
      <div className={styles.propertiesPanel}>
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
                                        <div style={{width: 30, height: 30, borderRadius: 4, background: selectedObject.fill as string, border:'1px solid #3f3f46', overflow:'hidden', position:'relative'}}>
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
                                        <span style={{fontSize:12, color:'#aaa'}}>Color</span>
                                    </div>

                                    {/* Style Buttons */}
                                    <div style={{display:'flex', gap:4, background:'#27272a', padding:4, borderRadius:6}}>
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
                                        <div style={{width:1, background:'#3f3f46', margin:'0 4px'}}></div>
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
                                            style={{width:'100%', background:'#27272a', color:'white', border:'1px solid #3f3f46', padding:4, borderRadius:4, fontSize:12, cursor:'pointer'}}
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
                                        <div style={{display:'flex', justifyContent:'space-between', fontSize:10, color:'#aaa', marginBottom:4}}>
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
                                        <div style={{display:'flex', justifyContent:'space-between', fontSize:10, color:'#aaa', marginBottom:4}}>
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
                                        <div style={{paddingLeft:8, borderLeft:'2px solid #333'}}>
                                            <div style={{fontSize:10, color:'#aaa', marginBottom:2}}>Blur</div>
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
                                            <div style={{fontSize:10, color:'#aaa', marginBottom:2}}>Distancia</div>
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
                          <p style={{color:'#666', fontSize:12, textAlign:'center', marginTop:20}}>Selecciona un objeto para editar.</p>
                      )}

                      <div className={styles.divider} style={{margin:'20px 0', borderTop:'1px solid #27272a'}}></div>
                      
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
                              style={{background:'#27272a', border:'1px solid #3f3f46', color:'#aaa', width:'100%', borderRadius:4, padding:'0 8px'}}
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
                              <div className={styles.layerPreview} style={{background: obj instanceof fabric.IText ? '#eee' : '#333'}}>
                                  {/* Preview icon */}
                              </div>
                              <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                                  {/* @ts-ignore */}
                                  {obj.datasetName || (obj.type === 'i-text' ? obj.text : obj.type)}
                              </span>
                              <div className={styles.layerActions}>
                                  <button className={styles.miniBtn} onClick={(e) => {
                                      e.stopPropagation();
                                      obj.visible = !obj.visible;
                                      obj.dirty = true;
                                      canvas?.requestRenderAll();
                                      updateLayers();
                                  }}>
                                      <Eye size={12} color={obj.visible ? '#aaa' : '#444'} />
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
                                      <Lock size={12} color={obj.lockMovementX ? '#eab308' : '#aaa'} />
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
      </div>
    </div>
  );
}
