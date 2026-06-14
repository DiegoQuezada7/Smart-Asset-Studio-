import { useState, useEffect, useCallback, useRef } from 'react';
import { removeBackground, preload } from "@imgly/background-removal";
import type { Config } from "@imgly/background-removal";
import { saveAsset, loadAllAssets, clearAssets, deleteAsset as deleteFromDb, updateAssetBlob, renameAsset, AssetRecord } from '../utils/storage';

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
}

const BG_CONFIG: Config = {
  model: 'isnet_fp16',
  proxyToWorker: true,
  output: { format: 'image/png', quality: 0.92 },
};

function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = url;
  });
}

export function useImageProcessor() {
  const [results, setResults] = useState<Record<string, ProcessedResult>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessingId, setCurrentProcessingId] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [processingProgress, setProcessingProgress] = useState<Record<string, string>>({});
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const modelPromiseRef = useRef<Promise<void> | null>(null);

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
        const initialProcessedUrl = asset.initialProcessedBlob
          ? trackUrl(URL.createObjectURL(asset.initialProcessedBlob))
          : undefined;
        restored[asset.id] = {
          id: asset.id,
          fileName: asset.fileName,
          originalUrl,
          processedUrl,
          initialProcessedUrl,
          status: 'completed',
          originalSize: asset.originalBlob.size,
        };
        // Get dimensions asynchronously
        getImageDimensions(originalUrl).then(dims => {
          setResults(prev => {
            const r = prev[asset.id];
            if (!r) return prev;
            return { ...prev, [asset.id]: { ...r, originalWidth: dims.width, originalHeight: dims.height } };
          });
        });
      }
      if (Object.keys(restored).length > 0) {
        setResults(restored);
      }
    });
  }, []);

  const processImages = async (files: File[], upscaleEnabled = false) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setIsProcessing(true);

    const newResults = { ...results };
    const tasks: { id: string; file: File }[] = [];

    files.forEach(file => {
      const id = crypto.randomUUID();
      tasks.push({ id, file });
      const url = trackUrl(URL.createObjectURL(file));
      newResults[id] = {
        id,
        originalUrl: url,
        processedUrl: '',
        status: 'processing',
        fileName: file.name,
        originalSize: file.size,
      };
      // Get dimensions asynchronously
      getImageDimensions(url).then(dims => {
        setResults(prev => {
          if (!prev[id]) return prev;
          return { ...prev, [id]: { ...prev[id], originalWidth: dims.width, originalHeight: dims.height } };
        });
      });
    });

    setResults(newResults);

    // Preload model if not already loaded
    if (!modelLoaded) {
      setProcessingProgress(prev => ({ ...prev, _model: 'Descargando modelo de IA...' }));
      await preloadModel();
      setProcessingProgress(prev => { const n = { ...prev }; delete n._model; return n; });
    }

    for (const task of tasks) {
      if (signal.aborted) break;
      setCurrentProcessingId(task.id);
      setProcessingProgress(prev => ({ ...prev, [task.id]: 'Eliminando fondo...' }));

      try {
        // Step 1: Background removal with progress
        const bgRemovedBlob = await removeBackground(task.file, {
          ...BG_CONFIG,
          progress: (key, current, total) => {
            if (key === 'compute:inference') {
              setProcessingProgress(prev => ({ ...prev, [task.id]: 'Analizando imagen...' }));
            } else if (key === 'compute:mask') {
              setProcessingProgress(prev => ({ ...prev, [task.id]: 'Aplicando máscara...' }));
            } else if (key === 'compute:encode') {
              setProcessingProgress(prev => ({ ...prev, [task.id]: 'Codificando resultado...' }));
            }
          },
        });

        if (signal.aborted) break;

        let finalBlob = bgRemovedBlob;

        // Step 2: Upscale if enabled (2x)
        if (upscaleEnabled) {
          setProcessingProgress(prev => ({ ...prev, [task.id]: 'Aplicando upscale...' }));
          try {
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
            const upscaleUrl = await upscaler.upscale(inputImg, { signal });
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
            c.getContext('2d')?.drawImage(upscaledImg, 0, 0);
            finalBlob = await new Promise<Blob>(resolve => {
              c.toBlob(b => resolve(b || bgRemovedBlob), 'image/png');
            });
          } catch (upscaleErr) {
            console.warn('Upscale failed, using bg-removed result:', upscaleErr);
          }
        }

        if (signal.aborted) break;

        const originalBlob = task.file;
        const processedBlob = finalBlob;
        const processedUrl = trackUrl(URL.createObjectURL(processedBlob));

        setProcessingProgress(prev => { const n = { ...prev }; delete n[task.id]; return n; });

        setResults(prev => ({
          ...prev,
          [task.id]: {
            ...prev[task.id],
            processedUrl,
            initialProcessedUrl: processedUrl,
            status: 'completed',
          }
        }));

        await saveAsset({
          id: task.id,
          fileName: task.file.name,
          originalBlob,
          processedBlob,
          initialProcessedBlob: processedBlob,
          timestamp: Date.now(),
        });

      } catch (error: any) {
        if (error?.name === 'AbortError') break;
        const msg = error?.message || error?.toString() || 'Error desconocido';
        console.error(msg);

        setProcessingProgress(prev => { const n = { ...prev }; delete n[task.id]; return n; });

        setResults(prev => ({
          ...prev,
          [task.id]: {
            ...prev[task.id],
            status: 'error',
            errorMessage: msg,
          }
        }));
      }
    }

    setCurrentProcessingId(null);
    setIsProcessing(false);
    abortRef.current = null;
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

      if (upscaleEnabled) {
        setProcessingProgress(prev => ({ ...prev, [id]: 'Aplicando upscale...' }));
        try {
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
          const upscaleUrl = await upscaler.upscale(inputImg, { signal });
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
          c.getContext('2d')?.drawImage(upscaledImg, 0, 0);
          finalBlob = await new Promise<Blob>(resolve => {
            c.toBlob(b => resolve(b || bgRemovedBlob), 'image/png');
          });
        } catch (e) {
          console.warn('Retry upscale failed:', e);
        }
      }

      if (signal.aborted) return;

      setProcessingProgress(prev => { const n = { ...prev }; delete n[id]; return n; });

      revokeUrl(asset.processedUrl);
      const processedUrl = trackUrl(URL.createObjectURL(finalBlob));

      setResults(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          processedUrl,
          initialProcessedUrl: processedUrl,
          status: 'completed',
          errorMessage: undefined,
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

  const processBatch = useCallback((files: File[], upscale?: boolean) => {
    processImages(files, upscale);
  }, []);

  return {
    results,
    isProcessing,
    currentProcessingId,
    modelLoading,
    modelLoaded,
    modelProgress,
    processingProgress,
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
