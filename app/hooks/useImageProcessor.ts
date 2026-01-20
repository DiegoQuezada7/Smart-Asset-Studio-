import { useState, useEffect, useCallback } from 'react';
import { removeBackground } from "@imgly/background-removal";
import { saveAsset, loadAllAssets, clearAssets, deleteAsset as deleteFromDb, updateAssetBlob, AssetRecord } from '../utils/storage';

export interface ProcessedResult {
  id: string; // Unique ID
  originalUrl: string;
  processedUrl: string;
  initialProcessedUrl?: string; // Backup
  status: 'processing' | 'completed' | 'error';
  fileName: string; // Original filename
}

export function useImageProcessor() {
  const [results, setResults] = useState<Record<string, ProcessedResult>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  // Load history on mount
  useEffect(() => {
    loadAllAssets().then((assets) => {
// ...
    });
  }, []);

  const processImages = async (files: File[]) => {
    setIsProcessing(true);
    
    // Create placeholders
    const newResults = { ...results };
    const tasks: {id: string, file: File}[] = [];

    files.forEach(file => {
        const id = crypto.randomUUID();
        tasks.push({ id, file });
        newResults[id] = {
// ...
            id,
            originalUrl: URL.createObjectURL(file), // Preview original
            processedUrl: '',
            status: 'processing',
            fileName: file.name
        };
    });

    setResults(newResults);

    // Process sequentially to save memory
    for (const task of tasks) {
        try {
            // Real processing using imgly
            const blob = await removeBackground(task.file);
            
            const originalBlob = task.file; 
            const processedBlob = blob;

            const processedUrl = URL.createObjectURL(processedBlob);

            setResults(prev => ({
                ...prev,
                [task.id]: {
                    ...prev[task.id],
                    processedUrl: processedUrl,
                    initialProcessedUrl: processedUrl, // Set backup
                    status: 'completed'
                }
            }));
            
            // Save to DB
            await saveAsset({
                id: task.id,
                fileName: task.file.name,
                originalBlob: originalBlob,
                processedBlob: processedBlob,
                initialProcessedBlob: processedBlob, // Save backup
                timestamp: Date.now()
            });

        } catch (error) {
            console.error(error);
            setResults(prev => ({
                ...prev,
                [task.id]: { ...prev[task.id], status: 'error' }
            }));
        }
    }

    setIsProcessing(false);
  };

  const clearHistory = useCallback(async () => {
      await clearAssets();
      setResults({});
  }, []);

  const updateResultBlob = useCallback(async (id: string, newBlob: Blob) => {
      // Update in memory
      const newUrl = URL.createObjectURL(newBlob);
      
      setResults(prev => {
          const current = prev[id];
          if (!current) return prev;
          
          return {
              ...prev,
              [id]: {
                  ...current,
                  processedUrl: newUrl
              }
          };
      });

      // Update in DB
      await updateAssetBlob(id, newBlob);
  }, []);
  
  const deleteAsset = useCallback(async (id: string) => {
    // Optimistic UI update
    setResults(prev => {
      const newResults = { ...prev };
      delete newResults[id];
      return newResults;
    });
    
    // Remove from IDB
    try {
        await deleteFromDb(id);
    } catch (e) {
      console.error("Failed to delete from DB", e);
    }
  }, []);

  // Dummy implementation for compatibility
  const renameFile = (...args: any[]) => {};
  const renameBatch = (...args: any[]) => {};
  const processBatch = processImages; // This one is tricky if processImages signature doesn't match. 
  // actually page.tsx calls processBatch(files, somethingElse?). processImages only takes files. 
  // Let's create a wrapper
  const processBatchWrapper = (...args: any[]) => processImages(args[0]);

  return { 
     results, 
     isProcessing, 
     processImages, 
     processBatch: processBatchWrapper, 
     updateResultBlob, 
     clearHistory,
     deleteAsset,
     renameFile,
     renameBatch
  };
}
