const DATABASE_NAME = "no-more-copium-local-media";
const DATABASE_VERSION = 1;
const BLOB_STORE = "blobs";

export async function putLocalBlob(key: string, blob: Blob): Promise<void> {
  const database = await openDatabase();
  await transactionRequest(database, "readwrite", (store) => store.put(blob, key));
}

export async function getLocalBlob(key: string): Promise<Blob | null> {
  const database = await openDatabase();
  const value = await transactionRequest(database, "readonly", (store) => store.get(key));
  return value instanceof Blob ? value : null;
}

export async function deleteLocalBlob(key: string): Promise<void> {
  const database = await openDatabase();
  await transactionRequest(database, "readwrite", (store) => store.delete(key));
}

export async function listLocalBlobs(): Promise<Array<{ key: string; blob: Blob }>> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(BLOB_STORE, "readonly");
    const store = transaction.objectStore(BLOB_STORE);
    const keyRequest = store.getAllKeys();
    const valueRequest = store.getAll();
    transaction.oncomplete = () => {
      const values = valueRequest.result;
      const blobs = keyRequest.result.flatMap((key, index) => {
        const value = values[index];
        return typeof key === "string" && value instanceof Blob ? [{ key, blob: value }] : [];
      });
      database.close();
      resolve(blobs);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Local image storage could not be listed."));
    };
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("This browser does not support local image storage."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(BLOB_STORE)) database.createObjectStore(BLOB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Local image storage could not open."));
  });
}

function transactionRequest(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(BLOB_STORE, mode);
    const request = createRequest(transaction.objectStore(BLOB_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local image storage failed."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Local image storage transaction failed."));
    };
  });
}
