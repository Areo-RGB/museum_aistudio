import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { FitMode } from '../types.ts';

const DB_NAME = 'media-gallery';
const DB_VERSION = 1;
const STORE = 'slots';

export interface SlotMediaRecord {
  slotId: string;
  blob: Blob;
  type: string;
  fit: FitMode;
  name: string;
  updatedAt: number;
}

export interface MediaGalleryDB extends DBSchema {
  slots: {
    key: string;
    value: SlotMediaRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<MediaGalleryDB>> | undefined;

function isFitMode(value: unknown): value is FitMode {
  return value === 'auto' || value === 'cover' || value === 'contain';
}

function isSlotMediaRecord(value: unknown): value is SlotMediaRecord {
  if (value === null || typeof value !== 'object') return false;
  if (
    !('slotId' in value) ||
    !('blob' in value) ||
    !('type' in value) ||
    !('fit' in value) ||
    !('name' in value) ||
    !('updatedAt' in value)
  ) {
    return false;
  }
  return (
    typeof value.slotId === 'string' &&
    value.blob instanceof Blob &&
    typeof value.type === 'string' &&
    isFitMode(value.fit) &&
    typeof value.name === 'string' &&
    typeof value.updatedAt === 'number'
  );
}

function db(): Promise<IDBPDatabase<MediaGalleryDB>> {
  dbPromise ??= openDB<MediaGalleryDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: 'slotId' });
      }
    },
  });
  return dbPromise;
}

export type SlotMediaInput = Omit<SlotMediaRecord, 'updatedAt'>;

export async function saveSlotMedia(record: SlotMediaInput): Promise<void> {
  const database = await db();
  await database.put(STORE, { ...record, updatedAt: Date.now() });
}

export async function getSlotMedia(slotId: string): Promise<SlotMediaRecord | undefined> {
  const database = await db();
  const value: unknown = await database.get(STORE, slotId);
  return isSlotMediaRecord(value) ? value : undefined;
}

export async function deleteSlotMedia(slotId: string): Promise<void> {
  const database = await db();
  await database.delete(STORE, slotId);
}
