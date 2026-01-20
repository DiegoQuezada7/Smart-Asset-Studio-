import { openDB } from 'idb';

const DB_NAME = 'smart-asset-db';
const STORE_NAME = 'assets';
const VERSION = 1;

export interface AssetRecord {
  id: string;
  fileName: string;
  originalBlob: Blob;
  processedBlob: Blob;
  initialProcessedBlob?: Blob; // Backup for reset functionality
  timestamp: number;
}

const initDB = async () => {
  return openDB(DB_NAME, VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
};

export const saveAsset = async (asset: AssetRecord) => {
  const db = await initDB();
  await db.put(STORE_NAME, asset);
};

export const loadAllAssets = async (): Promise<AssetRecord[]> => {
  const db = await initDB();
  return db.getAll(STORE_NAME);
};

export const clearAssets = async () => {
  const db = await initDB();
  await db.clear(STORE_NAME);
};

export const deleteAsset = async (id: string) => {
  const db = await initDB();
  await db.delete(STORE_NAME, id);
};

export const updateAssetBlob = async (id: string, newProcessedBlob: Blob) => {
  const db = await initDB();
  const asset = await db.get(STORE_NAME, id);
  if (asset) {
    asset.processedBlob = newProcessedBlob;
    await db.put(STORE_NAME, asset);
  }
};
