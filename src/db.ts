import { LocationItem, Trip, SecureDocument, Expense } from './types';

const DB_NAME = 'VagabondTravelDB';
const DB_VERSION = 1;

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;

      if (!db.objectStoreNames.contains('locations')) {
        db.createObjectStore('locations', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('trips')) {
        db.createObjectStore('trips', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('documents')) {
        db.createObjectStore('documents', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('expenses')) {
        db.createObjectStore('expenses', { keyPath: 'id' });
      }
    };
  });
}

// Generic Store Operations
export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as T[]);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveToStore<T>(storeName: string, item: T): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function deleteFromStore(storeName: string, id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Backup & Restore
export interface BackupData {
  locations: LocationItem[];
  trips: Trip[];
  documents: SecureDocument[];
  expenses: Expense[];
  exportedAt: string;
}

export async function exportAllData(): Promise<string> {
  const locations = await getAllFromStore<LocationItem>('locations');
  const trips = await getAllFromStore<Trip>('trips');
  const documents = await getAllFromStore<SecureDocument>('documents');
  const expenses = await getAllFromStore<Expense>('expenses');

  const backup: BackupData = {
    locations,
    trips,
    documents,
    expenses,
    exportedAt: new Date().toISOString(),
  };

  return JSON.stringify(backup, null, 2);
}

export async function importAllData(jsonString: string): Promise<void> {
  const backup: BackupData = JSON.parse(jsonString);
  const db = await initDB();

  // Clear existing and write new
  const stores = ['locations', 'trips', 'documents', 'expenses'] as const;

  for (const storeName of stores) {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    store.clear();
  }

  // Insert restored items
  if (backup.locations && Array.isArray(backup.locations)) {
    for (const item of backup.locations) {
      await saveToStore('locations', item);
    }
  }
  if (backup.trips && Array.isArray(backup.trips)) {
    for (const item of backup.trips) {
      await saveToStore('trips', item);
    }
  }
  if (backup.documents && Array.isArray(backup.documents)) {
    for (const item of backup.documents) {
      await saveToStore('documents', item);
    }
  }
  if (backup.expenses && Array.isArray(backup.expenses)) {
    for (const item of backup.expenses) {
      await saveToStore('expenses', item);
    }
  }
}
