import type { ImportedDeck } from './ankiImport';

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('n3-imported-anki', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('decks', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadImportedDecks(): Promise<ImportedDeck[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('decks').objectStore('decks').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

export async function writeImportedDeck(deck: ImportedDeck | string): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('decks', 'readwrite');
      const store = transaction.objectStore('decks');
      if (typeof deck === 'string') store.delete(deck); else store.put(deck);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
