import { describe, it, expect, beforeEach, vi } from 'vitest';

let dbInst: any;

vi.mock('idb', () => {
  const store = new Map<string, any>();
  const mockDb = {
    put: vi.fn((_store: string, val: any) => { store.set(val.id, val); return Promise.resolve(); }),
    get: vi.fn((_store: string, id: string) => {
      const entry = store.get(id);
      return Promise.resolve(entry ? { ...entry } : undefined);
    }),
    getAll: vi.fn((_store: string) => Promise.resolve(Array.from(store.values()))),
    delete: vi.fn((_store: string, id: string) => { store.delete(id); return Promise.resolve(); }),
    clear: vi.fn((_store: string) => { store.clear(); return Promise.resolve(); }),
  };
  dbInst = mockDb;
  return {
    openDB: vi.fn(() => Promise.resolve(mockDb)),
  };
});

describe('storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves and loads an asset', async () => {
    const { saveAsset, loadAllAssets } = await import('@/app/utils/storage');
    const asset = { id: '1', fileName: 'test', originalBlob: new Blob(['a']), processedBlob: new Blob(['b']), timestamp: 1 };
    await saveAsset(asset);
    const all = await loadAllAssets();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('1');
  });

  it('clears all assets', async () => {
    const { saveAsset, clearAssets, loadAllAssets } = await import('@/app/utils/storage');
    await saveAsset({ id: '1', fileName: 'a', originalBlob: new Blob(), processedBlob: new Blob(), timestamp: 1 });
    await saveAsset({ id: '2', fileName: 'b', originalBlob: new Blob(), processedBlob: new Blob(), timestamp: 2 });
    await clearAssets();
    expect(await loadAllAssets()).toHaveLength(0);
  });

  it('deletes a single asset', async () => {
    const { saveAsset, deleteAsset, loadAllAssets } = await import('@/app/utils/storage');
    await saveAsset({ id: '1', fileName: 'a', originalBlob: new Blob(), processedBlob: new Blob(), timestamp: 1 });
    await saveAsset({ id: '2', fileName: 'b', originalBlob: new Blob(), processedBlob: new Blob(), timestamp: 2 });
    await deleteAsset('1');
    const all = await loadAllAssets();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('2');
  });

  it('renames an asset', async () => {
    const { saveAsset, renameAsset, loadAllAssets } = await import('@/app/utils/storage');
    await saveAsset({ id: 'rename-1', fileName: 'old', originalBlob: new Blob(), processedBlob: new Blob(), timestamp: 1 });
    await renameAsset('rename-1', 'new');
    const all = await loadAllAssets();
    const asset = all.find(a => a.id === 'rename-1');
    expect(asset?.fileName).toBe('new');
  });

  it('updates asset blob', async () => {
    const { saveAsset, updateAssetBlob, loadAllAssets } = await import('@/app/utils/storage');
    await saveAsset({ id: 'blob-1', fileName: 'a', originalBlob: new Blob(), processedBlob: new Blob(['old']), timestamp: 1 });
    await updateAssetBlob('blob-1', new Blob(['new']));
    const all = await loadAllAssets();
    const asset = all.find(a => a.id === 'blob-1');
    const text = await asset!.processedBlob.text();
    expect(text).toBe('new');
  });

  it('handles rename of non-existent asset gracefully', async () => {
    const { renameAsset } = await import('@/app/utils/storage');
    await expect(renameAsset('nonexistent', 'new')).resolves.not.toThrow();
  });
});
