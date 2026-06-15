import { useState, useEffect, useCallback, useRef } from 'react';
import { removeBackground, preload } from "@imgly/background-removal";
import type { Config } from "@imgly/background-removal";
import { saveAsset, loadAllAssets, clearAssets, deleteAsset as deleteFromDb, updateAssetBlob, renameAsset } from '../utils/storage';

export interface ProcessedResult {
  id: string;
  originalUrl: string;
  processedUrl: string;
  initialProcessedUrl?: string;
  status: 'processing' | 'completed' | 'error';
  fileName: string;
  errorMessage?: string;
  originalSize?: number;
  originalWidth?: number;
  originalHeight?: number;
  wasUpscaled?: boolean;
  processedWidth?: number;
  processedHeight?: number;
  processingTimeMs?: number;
}

export interface ProcessingStats {
  totalProcessed: number;
  totalErrors: number;
  avgTimeMs: number;
  lastTimings: { fileName: string; step: string; ms: number }[];
}

const BG_CONFIG: Config = {
  model: 'isnet_fp16',
  proxyToWorker: true,
  output: { format: 'image/png', quality: 0.92 },
};

const TIMEOUT_MS = 120_000;

function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = url;
  });
}

function timeoutSignal(ms: number, parentSignal?: AbortSignal): { signal: AbortSignal; clear: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('Timeout', 'TimeoutError')), ms);
  const clear = () => clearTimeout(timer);
  if (parentSignal) {
    parentSignal.addEventListener('abort', () => { clearTimeout(timer); ctrl.abort(); }, { once: true });
  }
  return { signal: ctrl.signal, clear };
}

export function useImageProcessor() {
  const [results, setResults] = useState<Record<string, ProcessedResult>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessingId, setCurrentProcessingId] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [processingProgress, setProcessingProgress] = useState<Record<string, string>>({});
  const [processingStats, setProcessingStats] = useState<ProcessingStats>({ totalProcessed: 0, totalErrors: 0, avgTimeMs: 0, lastTimings: [] });
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const modelPromiseRef = useRef<Promise<void> | null>(null);
  const pendingIdByFileRef = useRef<Map<string, string>>(new Map());

  const preloadModel = useCallback(async () => {
    if (modelLoaded || modelPromiseRef.current) return modelPromiseRef.current;
    setModelLoading(true);
    setModelProgress(0);
    const promise = preload({
      ...BG_CONFIG,
      progress: (key, current, total) => {
        const pct = Math.round((current / total) * 100);
        setModelProgress(pct);
      },
    }).then(() => {
      setModelLoaded(true);
      setModelLoading(false);
    }).catch((err) => {
      console.warn('Model preload failed, will load on demand:', err);
      setModelLoading(false);
      modelPromiseRef.current = null;
    });
    modelPromiseRef.current = promise;
    return promise;
  }, [modelLoaded]);

  const trackUrl = (url: string) => {
    if (url) objectUrlsRef.current.add(url);
    return url;
  };

  const revokeUrl = (url?: string) => {
    if (url && objectUrlsRef.current.has(url)) {
      URL.revokeObjectURL(url);
      objectUrlsRef.current.delete(url);
    }
  };

  const revokeAllUrls = () => {
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
  };

  // Restore history from IndexedDB on mount
  useEffect(() => {
    loadAllAssets().then((assets) => {
      const restored: Record<string, ProcessedResult> = {};
      for (const asset of assets) {
        const originalUrl = trackUrl(URL.createObjectURL(asset.originalBlob));
        const processedUrl = trackUrl(URL.createObjectURL(asset.processedBlob));

        // In old records (898ad31) initialProcessedBlob was always set to processedBlob
        // In acee093 it was set to bgRemovedBlob only when upscaleEnabled
        // In 5444106+ wasUpscaled is persisted directly
        const initialProcessedBlobIsDifferent = asset.initialProcessedBlob && asset.initialProcessedBlob !== asset.processedBlob;
        const initialProcessedUrl = initialProcessedBlobIsDifferent
          ? trackUrl(URL.createObjectURL(asset.initialProcessedBlob!))
          : undefined;

        const wasUpscaledPersisted = asset.wasUpscaled;
        const needsDimensionInference = wasUpscaledPersisted == null && !initialProcessedBlobIsDifferent;
        const wasUpscaled = wasUpscaledPersisted ?? (initialProcessedBlobIsDifferent ? true : undefined);

        restored[asset.id] = {
          id: asset.id,
          fileName: asset.fileName,
          originalUrl,
          processedUrl,
          initialProcessedUrl,
          status: 'completed',
          originalSize: asset.originalBlob.size,
          wasUpscaled,
          processedWidth: asset.processedWidth,
          processedHeight: asset.processedHeight,
          processingTimeMs: asset.processingTimeMs,
        };
        // Get dimensions asynchronously
        getImageDimensions(originalUrl).then(dims => {
          setResults(prev => {
            const r = prev[asset.id];
            if (!r) return prev;
            return { ...prev, [asset.id]: { ...r, originalWidth: dims.width, originalHeight: dims.height } };
          });
        });
        // For old records where we can't determine wasUpscaled from metadata,
        // compare processed vs original dimensions to infer upscale
        if (needsDimensionInference) {
          const processedUrlForDims = processedUrl;
          getImageDimensions(processedUrlForDims).then(pDims => {
            getImageDimensions(originalUrl).then(oDims => {
              setResults(prev => {
                const r = prev[asset.id];
                if (!r) return prev;
                const inferred = pDims.width >= oDims.width * 1.9 && pDims.height >= oDims.height * 1.9;
                return {
                  ...prev,
                  [asset.id]: {
                    ...r,
                    wasUpscaled: inferred,
                    processedWidth: pDims.width,
                    processedHeight: pDims.height,
                  },
                };
              });
            });
          });
        }
      }
      if (Object.keys(restored).length > 0) {
        setResults(restored);
      }
    });
  }, []);

  const timingRef = useRef<{ fileName: string; step: string; ms: number }[]>([]);

  const processImages = async (files: File[], upscaleEnabled = false) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setIsProcessing(true);
    timingRef.current = [];

    const tasks: { id: string; file: File }[] = [];

    pendingIdByFileRef.current.clear();
    setResults(prev => {
      const next = { ...prev };
      files.forEach(file => {
        const id = crypto.randomUUID();
        tasks.push({ id, file });
        pendingIdByFileRef.current.set(file.name, id);
        const url = trackUrl(URL.createObjectURL(file));
        next[id] = {
          id,
          originalUrl: url,
          processedUrl: '',
          status: 'processing',
          fileName: file.name,
          originalSize: file.size,
        };
        getImageDimensions(url).then(dims => {
          setResults(p => {
            if (!p[id]) return p;
            return { ...p, [id]: { ...p[id], originalWidth: dims.width, originalHeight: dims.height } };
          });
        });
      });
      return next;
    });

    // Preload model if not already loaded
    if (!modelLoaded) {
      setProcessingProgress(prev => ({ ...prev, _model: 'Descargando modelo de IA...' }));
      const t0 = performance.now();
      await preloadModel();
      timingRef.current.push({ fileName: '_modelo', step: 'descarga', ms: Math.round(performance.now() - t0) });
      setProcessingProgress(prev => { const n = { ...prev }; delete n._model; return n; });
    }

    for (const task of tasks) {
      if (signal.aborted) break;
      setCurrentProcessingId(task.id);
      setProcessingProgress(prev => ({ ...prev, [task.id]: 'Eliminando fondo...' }));
      const tStart = performance.now();

      try {
        // Step 1: Background removal with timeout
        const tBg0 = performance.now();
        const bgTimeout = timeoutSignal(TIMEOUT_MS, signal);
        const bgRemovedBlob = await removeBackground(task.file, {
          ...BG_CONFIG,
          progress: (key: string, current: number, total: number) => {
            if (key === 'compute:inference') {
              setProcessingProgress(prev => ({ ...prev, [task.id]: 'Analizando imagen...' }));
            } else if (key === 'compute:mask') {
              setProcessingProgress(prev => ({ ...prev, [task.id]: 'Aplicando máscara...' }));
            } else if (key === 'compute:encode') {
              setProcessingProgress(prev => ({ ...prev, [task.id]: 'Codificando resultado...' }));
            }
          },
          // @ts-expect-error -- imgly accepts AbortSignal at runtime
          signal: bgTimeout.signal,
        });
        bgTimeout.clear();
        timingRef.current.push({ fileName: task.file.name, step: 'background-removal', ms: Math.round(performance.now() - tBg0) });

        if (signal.aborted) break;

        let finalBlob = bgRemovedBlob;
        let wasUpscaled = false;
        let processedWidth: number | undefined;
        let processedHeight: number | undefined;
        const bgRemovedUrl = trackUrl(URL.createObjectURL(bgRemovedBlob));

        // Step 2: Upscale if enabled (2x)
        if (upscaleEnabled) {
          setProcessingProgress(prev => ({ ...prev, [task.id]: 'Aplicando upscale...' }));
          const origDims = Object.values(results).find(r => r.id === task.id);
          if (origDims?.originalWidth && origDims.originalWidth > 2000) {
            console.warn(`Upscaling large image (${origDims.originalWidth}px) — this may take several minutes on CPU`);
          }
          const tUp0 = performance.now();
          try {
            const tf = await import('@tensorflow/tfjs');
            await tf.ready();
            await tf.setBackend('cpu');
            const { default: Upscaler } = await import('upscaler');
            const upscaler = new Upscaler();
            const inputImg = await new Promise<HTMLImageElement>((resolve, reject) => {
              const i = new Image();
              i.onload = () => resolve(i);
              i.onerror = reject;
              i.crossOrigin = 'anonymous';
              i.src = URL.createObjectURL(bgRemovedBlob);
            });
            if (signal.aborted) break;
            const upTimeout = timeoutSignal(TIMEOUT_MS, signal);
            const upscaleUrl = await upscaler.upscale(inputImg, { signal: upTimeout.signal });
            upTimeout.clear();
            if (signal.aborted) break;
            const upscaledDataUrl = typeof upscaleUrl === 'string' ? upscaleUrl : URL.createObjectURL(bgRemovedBlob);
            const upscaledImg = await new Promise<HTMLImageElement>((resolve, reject) => {
              const i = new Image();
              i.onload = () => resolve(i);
              i.onerror = reject;
              i.src = upscaledDataUrl;
            });
            const c = document.createElement('canvas');
            c.width = upscaledImg.width;
            c.height = upscaledImg.height;
            const ctx = c.getContext('2d')!;
            // Preserve original alpha: draw original BG-removed image scaled up as alpha mask,
            // then composite upscaled image over it with source-atop
            ctx.drawImage(inputImg, 0, 0, upscaledImg.width, upscaledImg.height);
            ctx.globalCompositeOperation = 'source-atop';
            ctx.drawImage(upscaledImg, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
            // Clean up near-transparent pixels to reduce white border artifacts
            const imgData = ctx.getImageData(0, 0, c.width, c.height);
            for (let i = 3; i < imgData.data.length; i += 4) {
              if (imgData.data[i] > 0 && imgData.data[i] < 15) imgData.data[i] = 0;
              if (imgData.data[i] > 240) imgData.data[i] = 255;
            }
            ctx.putImageData(imgData, 0, 0);
            finalBlob = await new Promise<Blob>(resolve => {
              c.toBlob(b => resolve(b || bgRemovedBlob), 'image/png');
            });
            wasUpscaled = true;
            processedWidth = upscaledImg.width;
            processedHeight = upscaledImg.height;
          } catch (upscaleErr: any) {
            if (upscaleErr?.name === 'TimeoutError') {
              console.warn(`Upscale timed out for ${task.file.name}`);
            } else {
              console.warn('Upscale failed, using bg-removed result:', upscaleErr);
            }
          }
          timingRef.current.push({ fileName: task.file.name, step: 'upscale', ms: Math.round(performance.now() - tUp0) });
        }

        if (signal.aborted) break;

        const totalMs = Math.round(performance.now() - tStart);
        const originalBlob = task.file;
        const processedBlob = finalBlob;
        const processedUrl = trackUrl(URL.createObjectURL(processedBlob));

        setProcessingProgress(prev => { const n = { ...prev }; delete n[task.id]; return n; });

        setResults(prev => ({
          ...prev,
          [task.id]: {
            ...prev[task.id],
            processedUrl,
            initialProcessedUrl: upscaleEnabled ? bgRemovedUrl : undefined,
            status: 'completed',
            wasUpscaled,
            processedWidth,
            processedHeight,
            processingTimeMs: totalMs,
          }
        }));

        setProcessingStats(prev => {
          const timings = timingRef.current;
          const lastTimings = [...prev.lastTimings, ...timings].slice(-100);
          const processed = prev.totalProcessed + 1;
          const allTimes = lastTimings.filter(t => t.fileName !== '_modelo' && t.step === 'background-removal').map(t => t.ms);
          const avg = allTimes.length > 0 ? Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length) : 0;
          return { totalProcessed: processed, totalErrors: prev.totalErrors, avgTimeMs: avg, lastTimings };
        });

        await saveAsset({
          id: task.id,
          fileName: task.file.name,
          originalBlob,
          processedBlob,
          initialProcessedBlob: upscaleEnabled ? bgRemovedBlob : undefined,
          wasUpscaled,
          processedWidth,
          processedHeight,
          processingTimeMs: totalMs,
          timestamp: Date.now(),
        });

      } catch (error: any) {
        if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
          if (error?.name === 'TimeoutError') {
            setResults(prev => ({
              ...prev,
              [task.id]: {
                ...prev[task.id],
                status: 'error',
                errorMessage: `La operación excedió el límite de ${TIMEOUT_MS / 1000}s`,
                processingTimeMs: Math.round(performance.now() - tStart),
              }
            }));
          }
          break;
        }
        const msg = error?.message || error?.toString() || 'Error desconocido';
        console.error(msg);

        setProcessingProgress(prev => { const n = { ...prev }; delete n[task.id]; return n; });

        setResults(prev => ({
          ...prev,
          [task.id]: {
            ...prev[task.id],
            status: 'error',
            errorMessage: msg,
            processingTimeMs: Math.round(performance.now() - tStart),
          }
        }));

        setProcessingStats(prev => ({ ...prev, totalErrors: prev.totalErrors + 1 }));
      }
    }

    setCurrentProcessingId(null);
    setIsProcessing(false);
    abortRef.current = null;
  };

  const getResultIdByFileName = (fileName: string): string | undefined => {
    return pendingIdByFileRef.current.get(fileName);
  };

  const cancelProcessing = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retryAsset = useCallback(async (id: string, upscaleEnabled = false) => {
    const asset = results[id];
    if (!asset || !asset.originalUrl) return;

    setIsProcessing(true);
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    // Preload model if not already loaded
    if (!modelLoaded) {
      await preloadModel();
    }

    setProcessingProgress(prev => ({ ...prev, [id]: 'Eliminando fondo...' }));

    try {
      const response = await fetch(asset.originalUrl);
      const fileBlob = await response.blob();
      const file = new File([fileBlob], asset.fileName, { type: fileBlob.type });

      const bgRemovedBlob = await removeBackground(file, {
        ...BG_CONFIG,
        progress: (key) => {
          if (key === 'compute:inference') {
            setProcessingProgress(prev => ({ ...prev, [id]: 'Analizando imagen...' }));
          } else if (key === 'compute:mask') {
            setProcessingProgress(prev => ({ ...prev, [id]: 'Aplicando máscara...' }));
          }
        },
      });
      if (signal.aborted) return;

      let finalBlob = bgRemovedBlob;
      let wasUpscaled = false;
      let processedWidth: number | undefined;
      let processedHeight: number | undefined;
      const bgRemovedUrl = trackUrl(URL.createObjectURL(bgRemovedBlob));

      if (upscaleEnabled) {
        setProcessingProgress(prev => ({ ...prev, [id]: 'Aplicando upscale...' }));
        try {
          const tf = await import('@tensorflow/tfjs');
          await tf.ready();
          await tf.setBackend('cpu');
          const { default: Upscaler } = await import('upscaler');
          const upscaler = new Upscaler();
          const inputImg = await new Promise<HTMLImageElement>((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.crossOrigin = 'anonymous';
            i.src = URL.createObjectURL(bgRemovedBlob);
          });
          if (signal.aborted) return;
          const upTimeout = timeoutSignal(TIMEOUT_MS, signal);
          const upscaleUrl = await upscaler.upscale(inputImg, { signal: upTimeout.signal });
          upTimeout.clear();
          if (signal.aborted) return;
          const upscaledDataUrl = typeof upscaleUrl === 'string' ? upscaleUrl : URL.createObjectURL(bgRemovedBlob);
          const upscaledImg = await new Promise<HTMLImageElement>((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.src = upscaledDataUrl;
          });
          const c = document.createElement('canvas');
          c.width = upscaledImg.width;
          c.height = upscaledImg.height;
          const ctx = c.getContext('2d')!;
          ctx.drawImage(inputImg, 0, 0, upscaledImg.width, upscaledImg.height);
          ctx.globalCompositeOperation = 'source-atop';
          ctx.drawImage(upscaledImg, 0, 0);
          ctx.globalCompositeOperation = 'source-over';
          const imgData = ctx.getImageData(0, 0, c.width, c.height);
          for (let i = 3; i < imgData.data.length; i += 4) {
            if (imgData.data[i] > 0 && imgData.data[i] < 15) imgData.data[i] = 0;
            if (imgData.data[i] > 240) imgData.data[i] = 255;
          }
          ctx.putImageData(imgData, 0, 0);
          finalBlob = await new Promise<Blob>(resolve => {
            c.toBlob(b => resolve(b || bgRemovedBlob), 'image/png');
          });
          wasUpscaled = true;
          processedWidth = upscaledImg.width;
          processedHeight = upscaledImg.height;
        } catch (e) {
          console.warn('Retry upscale failed:', e);
        }
      }

      if (signal.aborted) return;

      setProcessingProgress(prev => { const n = { ...prev }; delete n[id]; return n; });

      revokeUrl(asset.processedUrl);

      // Revoke previous initialProcessedUrl if it existed
      if (asset.initialProcessedUrl && asset.initialProcessedUrl !== asset.processedUrl) {
        revokeUrl(asset.initialProcessedUrl);
      }

      const processedUrl = trackUrl(URL.createObjectURL(finalBlob));

      setResults(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          processedUrl,
          initialProcessedUrl: upscaleEnabled ? bgRemovedUrl : undefined,
          status: 'completed',
          errorMessage: undefined,
          wasUpscaled,
          processedWidth,
          processedHeight,
        }
      }));

      await updateAssetBlob(id, finalBlob);

    } catch (error: any) {
      const msg = error?.message || 'Error al reintentar';
      setProcessingProgress(prev => { const n = { ...prev }; delete n[id]; return n; });
      setResults(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          status: 'error',
          errorMessage: msg,
        }
      }));
    }

    setIsProcessing(false);
    abortRef.current = null;
  }, [results, modelLoaded, preloadModel]);

  const clearHistory = useCallback(async () => {
    revokeAllUrls();
    await clearAssets();
    setResults({});
  }, []);

  const updateResultBlob = useCallback(async (id: string, newBlob: Blob) => {
    revokeUrl(results[id]?.processedUrl);
    const newUrl = trackUrl(URL.createObjectURL(newBlob));

    setResults(prev => {
      const current = prev[id];
      if (!current) return prev;
      return {
        ...prev,
        [id]: {
          ...current,
          processedUrl: newUrl,
        }
      };
    });

    await updateAssetBlob(id, newBlob);
  }, [results]);

  const deleteAsset = useCallback(async (id: string) => {
    const asset = results[id];
    if (asset) {
      revokeUrl(asset.originalUrl);
      revokeUrl(asset.processedUrl);
      revokeUrl(asset.initialProcessedUrl);
    }
    setResults(prev => {
      const newResults = { ...prev };
      delete newResults[id];
      return newResults;
    });
    try {
      await deleteFromDb(id);
    } catch (e) {
      console.error("Failed to delete from DB", e);
    }
  }, [results]);

  const deleteMultiple = useCallback(async (ids: string[]) => {
    for (const id of ids) {
      const asset = results[id];
      if (asset) {
        revokeUrl(asset.originalUrl);
        revokeUrl(asset.processedUrl);
        revokeUrl(asset.initialProcessedUrl);
      }
    }
    setResults(prev => {
      const newResults = { ...prev };
      for (const id of ids) delete newResults[id];
      return newResults;
    });
    for (const id of ids) {
      try {
        await deleteFromDb(id);
      } catch (e) {
        console.error("Failed to delete from DB", e);
      }
    }
  }, [results]);

  const renameFile = useCallback(async (id: string, newName: string) => {
    setResults(prev => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: { ...prev[id], fileName: newName }
      };
    });
    await renameAsset(id, newName);
  }, []);

  const renameBatch = useCallback(async (prefix: string) => {
    let index = 1;
    const updates: [string, string][] = [];
    const newResults = { ...results };

    for (const [id, asset] of Object.entries(newResults)) {
      const ext = asset.fileName.replace(/^.*\./, '');
      const newName = `${prefix}-${String(index).padStart(2, '0')}.${ext}`;
      newResults[id] = { ...asset, fileName: newName };
      updates.push([id, newName]);
      index++;
    }

    setResults(newResults);

    for (const [id, name] of updates) {
      await renameAsset(id, name);
    }
  }, [results]);

  const processBatch = (files: File[], upscale?: boolean) => {
    processImages(files, upscale);
  };

  return {
    results,
    isProcessing,
    currentProcessingId,
    modelLoading,
    modelLoaded,
    modelProgress,
    processingProgress,
    processingStats,
    getResultIdByFileName,
    preloadModel,
    processImages,
    processBatch,
    cancelProcessing,
    retryAsset,
    updateResultBlob,
    clearHistory,
    deleteAsset,
    deleteMultiple,
    renameFile,
    renameBatch,
  };
}
