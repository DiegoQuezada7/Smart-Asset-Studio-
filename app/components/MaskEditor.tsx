"use client";

import { useRef, useEffect, useState, useCallback } from 'react';
import { X, Check, Eraser, PenTool, ZoomIn, ZoomOut, Hand, RotateCcw, RotateCw, Stamp, Droplet } from 'lucide-react';
import styles from './MaskEditor.module.css';

interface MaskEditorProps {
  originalUrl: string;
  processedUrl: string;
  initialProcessedUrl?: string; // The raw AI output for resetting
  onSave: (newBlob: Blob) => void;
  onCancel: () => void;
}

export default function MaskEditor({ originalUrl, processedUrl, initialProcessedUrl, onSave, onCancel }: MaskEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [tool, setTool] = useState<'erase' | 'restore' | 'pan' | 'clone' | 'blur'>('erase');
  const [prevTool, setPrevTool] = useState<'erase' | 'restore' | 'clone' | 'blur'>('erase'); 
  const [brushSize, setBrushSize] = useState(20);
  
  // Clone Tool State
  const [cloneSource, setCloneSource] = useState<{x:number, y:number} | null>(null);
  const [cloneOffset, setCloneOffset] = useState<{x:number, y:number} | null>(null);

  // Transform State
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Images
  const [imgOriginal, setImgOriginal] = useState<HTMLImageElement | null>(null);
  const [imgProcessed, setImgProcessed] = useState<HTMLImageElement | null>(null);
  const [imgInitial, setImgInitial] = useState<HTMLImageElement | null>(null);
  const [nativeSize, setNativeSize] = useState({ width: 0, height: 0 });
  
  const [canvasSnapshot, setCanvasSnapshot] = useState<HTMLCanvasElement | null>(null);

  // Undo/Redo State
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyStep, setHistoryStep] = useState(0);

  const saveHistory = () => {
    const canvas = canvasRef.current;
    if(!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if(!ctx) return;

    try {
        const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // If we are in the middle of history, truncate future steps
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(currentState);
        
        // Limit history size to 20 to prevent memory explosion
        if (newHistory.length > 20) newHistory.shift();

        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
    } catch(e) {
        console.error("History save failed", e);
    }
  };

  const undo = () => {
      if (historyStep > 0) {
          const newStep = historyStep - 1;
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (canvas && ctx && history[newStep]) {
              ctx.putImageData(history[newStep], 0, 0);
              setHistoryStep(newStep);
          }
      }
  };

  const redo = () => {
      if (historyStep < history.length - 1) {
          const newStep = historyStep + 1;
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (canvas && ctx && history[newStep]) {
              ctx.putImageData(history[newStep], 0, 0);
              setHistoryStep(newStep);
          }
      }
  };

  useEffect(() => {
    const img1 = new Image();
    img1.src = originalUrl;
    img1.crossOrigin = "anonymous";
    
    const img2 = new Image();
    img2.src = processedUrl;
    img2.crossOrigin = "anonymous";

    const img3 = new Image();
    if (initialProcessedUrl) {
        img3.src = initialProcessedUrl;
        img3.crossOrigin = "anonymous";
    }

    let loaded = 0;
    const totalToLoad = initialProcessedUrl ? 3 : 2;

    const onLoad = () => {
      loaded++;
      if (loaded === totalToLoad) {
        setImgOriginal(img1);
        setImgProcessed(img2);
        if (initialProcessedUrl) setImgInitial(img3);
      }
    };

    img1.onload = onLoad;
    img2.onload = onLoad;
    if (initialProcessedUrl) img3.onload = onLoad;
    
  }, [originalUrl, processedUrl, initialProcessedUrl]);

  // Initialize canvas when images are ready (runs after React commits state)
  useEffect(() => {
    if (!imgOriginal || !imgProcessed) return;
    const targetImg = imgInitial || imgProcessed;
    if (!targetImg) return;

    redrawCanvas(targetImg);
    fitViewport(imgOriginal.width, imgOriginal.height);
    setTimeout(() => saveHistory(), 100);
  }, [imgOriginal, imgProcessed]); 

  // Keyboard Shortcuts Effect
  useEffect(() => {
    // Global key listeners for shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
        // Undo / Redo
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

        // Brush size: [ = decrease, ] = increase
        if (e.key === '[') {
            e.preventDefault();
            setBrushSize(prev => Math.max(5, prev - 5));
            return;
        }
        if (e.key === ']') {
            e.preventDefault();
            setBrushSize(prev => Math.min(100, prev + 5));
            return;
        }

        // Tool shortcuts
        if (e.key === 'e' || e.key === 'E') setTool('erase');
        if (e.key === 'r' || e.key === 'R') setTool('restore');
        if (e.key === 'c' || e.key === 'C') setTool('clone');
        if (e.key === 'b' || e.key === 'B') setTool('blur');

        // Tools
        setTool(currentTool => {
            if (e.code === 'Space' && currentTool !== 'pan') {
                setPrevTool(currentTool as 'erase'|'restore'|'clone'|'blur');
                return 'pan';
            }
            return currentTool;
        });
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
            setTool(latestTool => latestTool === 'pan' ? prevTool : latestTool);
        }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [history, historyStep, prevTool]); // Separated dependencies
  
  const getPointerPos = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const pointerDown = (clientX: number, clientY: number, ctrlKey: boolean) => {
      // Pan Logic
      if (tool === 'pan') { 
          setIsDragging(true);
          setDragStart({ x: clientX - pan.x, y: clientY - pan.y });
          return;
      }

      // Clone Source Set Logic (Ctrl + Click)
      if (tool === 'clone' && ctrlKey) {
          const pos = getPointerPos(clientX, clientY);
          setCloneSource(pos);
          alert("Origen de clonado fijado.");
          return;
      }

      // Drawing Logic
      if (tool === 'clone' && !cloneSource) {
          alert("Mantén presionado CTRL y haz clic para definir desde dónde copiar.");
          return;
      }

      setIsDragging(true);
      
      // Clone Prep
      if (tool === 'clone' && canvasRef.current) {
          const snapshot = document.createElement('canvas');
          snapshot.width = canvasRef.current.width;
          snapshot.height = canvasRef.current.height;
          snapshot.getContext('2d')?.drawImage(canvasRef.current, 0, 0);
          setCanvasSnapshot(snapshot);
          
          const pos = getPointerPos(clientX, clientY);
          setCloneOffset({
              x: pos.x - cloneSource!.x,
              y: pos.y - cloneSource!.y
          });
      }

      doDraw(clientX, clientY); 
  };

  const pointerMove = (clientX: number, clientY: number) => {
      if (!isDragging) return;

      if (tool === 'pan') {
          setPan({
              x: clientX - dragStart.x,
              y: clientY - dragStart.y
          });
      } else {
          doDraw(clientX, clientY);
      }
  };

  const pointerUp = () => {
      if (isDragging) {
          saveHistory();
      }
      setIsDragging(false);
      setCanvasSnapshot(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      if (e.button === 1) { // middle button
          setIsDragging(true);
          setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
          e.preventDefault();
          return;
      }
      pointerDown(e.clientX, e.clientY, e.ctrlKey || e.metaKey);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      pointerMove(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
      pointerUp();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
          const t = e.touches[0];
          pointerDown(t.clientX, t.clientY, false);
      }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
          e.preventDefault();
          const t = e.touches[0];
          pointerMove(t.clientX, t.clientY);
      }
  };

  const handleTouchEnd = () => {
      pointerUp();
  };

  const doDraw = (clientX: number, clientY: number) => {
    if (!canvasRef.current || (tool === 'restore' && !imgOriginal)) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const { x, y } = getPointerPos(clientX, clientY);
    
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(x, y); 
      ctx.lineTo(x, y); 
      ctx.stroke();
    } else if (tool === 'restore') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(imgOriginal!, 0, 0);
      ctx.restore();
    } else if (tool === 'clone' && canvasSnapshot && cloneOffset) {
       const sourceX = x - cloneOffset.x;
       const sourceY = y - cloneOffset.y;
       
       ctx.globalCompositeOperation = 'source-over';
       ctx.save();
       ctx.beginPath();
       ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
       ctx.clip();
       
       ctx.drawImage(
           canvasSnapshot,
           sourceX - brushSize / 2, 
           sourceY - brushSize / 2, 
           brushSize,               
           brushSize,               
           x - brushSize / 2,       
           y - brushSize / 2,       
           brushSize,               
           brushSize                
       );
       
       ctx.restore();
    } else if (tool === 'blur') {
       ctx.globalCompositeOperation = 'source-over';
       ctx.save();
       ctx.beginPath();
       ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
       ctx.clip();
       
       // Blur Magic
       (ctx as any).filter = 'blur(4px)';
       ctx.drawImage(canvasRef.current, 0, 0);
       (ctx as any).filter = 'none';
       
       ctx.restore();
    }
  };

  const redrawCanvas = useCallback((img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    }
    setNativeSize({ width: img.width, height: img.height });
  }, []);

  const fitViewport = useCallback((imgW: number, imgH: number) => {
    const avW = window.innerWidth * 0.85;
    const avH = (window.innerHeight - 60) * 0.85;
    const computedScale = avW > 0 && avH > 0
      ? Math.min(avW / imgW, avH / imgH, 1)
      : 1;
    setScale(computedScale);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleSave = () => {
    canvasRef.current?.toBlob((blob) => {
      if (blob) onSave(blob);
    }, 'image/png');
  };
  
  const handleReset = useCallback(() => {
      const targetImg = imgInitial || imgProcessed;
      if (imgOriginal && targetImg) {
          redrawCanvas(targetImg);
          fitViewport(imgOriginal.width, imgOriginal.height);
          setTimeout(() => saveHistory(), 100);
      }
  }, [imgOriginal, imgProcessed, imgInitial, redrawCanvas, fitViewport]);

  const handleWheel = (e: React.WheelEvent) => {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(s => Math.max(0.1, Math.min(10, s * delta)));
  };

  return (
    <div className={styles.overlay} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div className={styles.toolbar}>
         <div className={styles.tools}>
            <button className={`${styles.toolBtn} ${tool === 'erase' ? styles.active : ''}`} onClick={() => setTool('erase')} title="Borrar (E)">
               <Eraser size={18} /> Borrar
            </button>
            <button className={`${styles.toolBtn} ${tool === 'restore' ? styles.active : ''}`} onClick={() => setTool('restore')} title="Restaurar (R)">
               <PenTool size={18} /> Restaurar
            </button>
            <button className={`${styles.toolBtn} ${tool === 'clone' ? styles.active : ''}`} onClick={() => setTool('clone')} title="Tampón (C) - Ctrl+Click para fijar origen">
               <Stamp size={18} /> Tampón
            </button>
            <button className={`${styles.toolBtn} ${tool === 'blur' ? styles.active : ''}`} onClick={() => setTool('blur')} title="Suavizar (B)">
               <Droplet size={18} /> Suavizar
            </button>
            <div className={styles.divider}></div>
             <button 
                 className={`${styles.toolBtn} ${historyStep <= 0 ? styles.disabled : ''}`} 
                 onClick={undo}
                 title="Deshacer (Ctrl+Z)"
              >
                 <RotateCcw size={18} />
              </button>
              <button 
                 className={`${styles.toolBtn} ${historyStep >= history.length - 1 ? styles.disabled : ''}`} 
                 onClick={redo}
                 title="Rehacer (Ctrl+Y)"
              >
                 <RotateCw size={18} />
              </button>
            <div className={styles.divider}></div>
            
            <button className={`${styles.toolBtn} ${tool === 'pan' ? styles.active : ''}`} onClick={() => setTool('pan')} title="Mover (Espacio)">
               <Hand size={18} /> Mover
            </button>
            <div className={styles.divider}></div>
            <button className={styles.toolBtn} onClick={handleReset} title="Reiniciar a Original">
               <RotateCcw size={18} /> Reiniciar
            </button>
            
            <div className={styles.brushSize}>
               Tamaño: {brushSize}px
               <input type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className={styles.slider} />
            </div>
         </div>

         <div className={styles.actions}>
            <button className={styles.toolBtn} onClick={onCancel}>
               <X size={18} /> Cancelar
            </button>
            <button className={`${styles.toolBtn} ${styles.active}`} onClick={handleSave}>
               <Check size={18} /> Guardar
            </button>
         </div>
      </div>

      <div className={styles.canvasContainer} onWheel={handleWheel} style={{cursor: tool === 'pan' ? 'grab' : 'crosshair'}}>
          <div style={{
            width: nativeSize.width > 0 ? `${nativeSize.width * scale}px` : '0px',
            height: nativeSize.height > 0 ? `${nativeSize.height * scale}px` : '0px',
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <canvas 
              ref={canvasRef}
              className={styles.canvas}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
          
          <div className={styles.zoomControls}>
              <button onClick={() => setScale(s => Math.max(0.1, s - 0.2))} style={{background: 'transparent', border:'none', color:'var(--text-main)'}}><ZoomOut size={20}/></button>
             <span style={{color:'var(--text-main)', fontSize:'12px'}}>{Math.round(scale * 100)}%</span>
             <button onClick={() => setScale(s => Math.min(10, s + 0.2))} style={{background: 'transparent', border:'none', color:'var(--text-main)'}}><ZoomIn size={20}/></button>
             <button onClick={() => { setScale(1); setPan({x:0, y:0}); }} style={{background: 'transparent', border:'none', color:'var(--text-muted)', fontSize:10, marginLeft:5}}>RESET VISTA</button>
          </div>

           {/* PIP Preview - original image reference */}
           {imgOriginal && (
               <div style={{
                   position:'absolute', bottom: 20, right: 20,
                   width: 120, height: 120, borderRadius: 8,
                   border: '2px solid var(--border-active)',
                   overflow: 'hidden', opacity: 0.6,
                   pointerEvents: 'none',
                    boxShadow: 'var(--shadow-md)',
               }}>
                   <img src={originalUrl} alt="" style={{width:'100%', height:'100%', objectFit:'contain'}} />
                    <div style={{
                        position:'absolute', bottom: 0, left: 0, right: 0,
                        background: 'var(--overlay-strong)',
                        fontSize: 8, color: 'var(--primary-text)',
                        textAlign: 'center', padding: '2px',
                    }}>
                       Original
                   </div>
               </div>
           )}

           <div style={{position:'absolute', bottom: 20, left: '50%', transform:'translateX(-50%)', color:'var(--primary-text)', fontSize:12, pointerEvents:'none', textAlign:'center', opacity:0.6}}>
             Espacio + Arrastrar para mover | Tampón: Ctrl+Clic | [ ] Tamaño pincel
          </div>
      </div>
    </div>
  );
}
