import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockSaveAsset = vi.fn();
const mockLoadAllAssets = vi.fn().mockResolvedValue([]);
const mockClearAssets = vi.fn();
const mockDeleteAsset = vi.fn();
const mockUpdateAssetBlob = vi.fn();
const mockRenameAsset = vi.fn();

vi.mock('@/app/utils/storage', () => ({
  saveAsset: (...args: any[]) => mockSaveAsset(...args),
  loadAllAssets: (...args: any[]) => mockLoadAllAssets(...args),
  clearAssets: (...args: any[]) => mockClearAssets(...args),
  deleteAsset: (...args: any[]) => mockDeleteAsset(...args),
  updateAssetBlob: (...args: any[]) => mockUpdateAssetBlob(...args),
  renameAsset: (...args: any[]) => mockRenameAsset(...args),
}));

const mockRemoveBg = vi.fn();
const mockPreload = vi.fn();

vi.mock('@imgly/background-removal', () => ({
  removeBackground: (...args: any[]) => mockRemoveBg(...args),
  preload: (...args: any[]) => mockPreload(...args),
}));

let objectUrlCounter = 0;

const mockCreateObjectURL = vi.fn((_blob: Blob | MediaSource) => {
  const url = `blob:mock/${++objectUrlCounter}`;
  return url;
});
const mockRevokeObjectURL = vi.fn();

function createMockFile(name: string, size = 1024, type = 'image/png'): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

describe('useImageProcessor', () => {
  beforeEach(() => {
    mockRemoveBg.mockReset();
    mockPreload.mockReset().mockResolvedValue(undefined);
    mockSaveAsset.mockReset();
    mockLoadAllAssets.mockReset().mockResolvedValue([]);
    mockClearAssets.mockReset();
    objectUrlCounter = 0;

    vi.spyOn(URL, 'createObjectURL').mockImplementation(mockCreateObjectURL);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(mockRevokeObjectURL);

    mockRemoveBg.mockImplementation(async (_file: File, _config?: any) => {
      return new Blob([_file], { type: 'image/png' });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });



  it('should return initial state', async () => {
    const { useImageProcessor } = await import('@/app/hooks/useImageProcessor');
    const { result } = renderHook(() => useImageProcessor());
    expect(result.current.results).toEqual({});
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.modelLoaded).toBe(false);
    expect(result.current.currentProcessingId).toBeNull();
    expect(result.current.processingStats.totalProcessed).toBe(0);
    expect(result.current.processingStats.totalErrors).toBe(0);
  });

  it('should process a single file with background removal', async () => {
    const { useImageProcessor } = await import('@/app/hooks/useImageProcessor');
    const { result } = renderHook(() => useImageProcessor());
    const file = createMockFile('test.png');

    act(() => { result.current.processImages([file], false); });

    await waitFor(() => {
      expect(result.current.isProcessing).toBe(false);
    });

    const entries = Object.values(result.current.results);
    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe('completed');
    expect(entries[0].fileName).toBe('test.png');
    expect(entries[0].wasUpscaled).toBe(false);
    expect(mockRemoveBg).toHaveBeenCalledTimes(1);
    expect(mockSaveAsset).toHaveBeenCalledTimes(1);
  });

  it('should use processBatch without stale closure', async () => {
    const { useImageProcessor } = await import('@/app/hooks/useImageProcessor');
    const { result } = renderHook(() => useImageProcessor());
    const file1 = createMockFile('img1.png');
    const file2 = createMockFile('img2.png');

    act(() => { result.current.processBatch([file1], false); });
    await waitFor(() => { expect(result.current.isProcessing).toBe(false); });

    expect(Object.keys(result.current.results)).toHaveLength(1);

    act(() => { result.current.processBatch([file2], false); });
    await waitFor(() => { expect(result.current.isProcessing).toBe(false); });

    const entries = Object.values(result.current.results);
    expect(entries).toHaveLength(2);
    expect(entries.map(e => e.fileName).sort()).toEqual(['img1.png', 'img2.png']);
  });

  it('should report error when background removal fails', async () => {
    const { useImageProcessor } = await import('@/app/hooks/useImageProcessor');
    mockRemoveBg.mockRejectedValue(new Error('Modelo no disponible'));

    const { result } = renderHook(() => useImageProcessor());
    const file = createMockFile('fail.png');

    act(() => { result.current.processImages([file], false); });

    await waitFor(() => {
      expect(result.current.isProcessing).toBe(false);
    });

    const entries = Object.values(result.current.results);
    expect(entries[0].status).toBe('error');
    expect(entries[0].errorMessage).toContain('Modelo no disponible');
    expect(result.current.processingStats.totalErrors).toBe(1);
  });

  it('should support cancellation', async () => {
    const { useImageProcessor } = await import('@/app/hooks/useImageProcessor');
    mockRemoveBg.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useImageProcessor());
    const file = createMockFile('hold.png');

    act(() => { result.current.processImages([file], false); });
    expect(result.current.isProcessing).toBe(true);

    act(() => { result.current.cancelProcessing(); });

    await waitFor(() => {
      expect(result.current.isProcessing).toBe(false);
    });
  });

  it('should return correct id by filename', async () => {
    const { useImageProcessor } = await import('@/app/hooks/useImageProcessor');
    const { result } = renderHook(() => useImageProcessor());
    const file = createMockFile('findme.png');

    act(() => { result.current.processImages([file], false); });
    await waitFor(() => { expect(result.current.isProcessing).toBe(false); });

    const id = result.current.getResultIdByFileName('findme.png');
    expect(id).toBeDefined();
    expect(result.current.results[id!].fileName).toBe('findme.png');
  });

  it('should process multiple files sequentially', async () => {
    const { useImageProcessor } = await import('@/app/hooks/useImageProcessor');
    const { result } = renderHook(() => useImageProcessor());
    const files = [createMockFile('a.png'), createMockFile('b.png'), createMockFile('c.png')];

    act(() => { result.current.processImages(files, false); });
    await waitFor(() => { expect(result.current.isProcessing).toBe(false); });

    const entries = Object.values(result.current.results);
    expect(entries).toHaveLength(3);
    entries.forEach(e => expect(e.status).toBe('completed'));
    expect(result.current.processingStats.totalProcessed).toBe(3);
  });

  it('should clear history and revoke URLs', async () => {
    const { useImageProcessor } = await import('@/app/hooks/useImageProcessor');
    const { result } = renderHook(() => useImageProcessor());
    const file = createMockFile('del.png');

    act(() => { result.current.processImages([file], false); });
    await waitFor(() => { expect(result.current.isProcessing).toBe(false); });

    expect(Object.keys(result.current.results)).toHaveLength(1);

    await act(async () => { await result.current.clearHistory(); });

    await waitFor(() => {
      expect(Object.keys(result.current.results)).toHaveLength(0);
    });
    expect(mockClearAssets).toHaveBeenCalled();
  });
});
