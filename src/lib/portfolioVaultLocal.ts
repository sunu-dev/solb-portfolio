/** Encrypted durable cache/outbox, staged and not yet connected to Zustand.
 * Only ciphertext and synchronization metadata enter IndexedDB. No key material
 * is persisted. Two tabs must compare the previous slot token before replacing.
 */
import { parseEncryptedPortfolioRecord, type PortfolioVaultKey, type EncryptedPortfolioRecord } from './portfolioVaultCrypto';
import { openPortfolioPayload, sealPortfolioPayload, type PortfolioVaultPayload } from './portfolioVaultPayload';

export const PORTFOLIO_VAULT_DB = 'joobi-private-portfolio-v1';
const STORE = 'records';
type Slot = 'backup' | 'outbox';
interface StoredSlot {
  ownerId: string; slot: Slot; token: string; revision: number; record: EncryptedPortfolioRecord;
}
export interface OpenedVaultSlot { token: string; revision: number; payload: PortfolioVaultPayload }
export class PortfolioVaultLocalError extends Error {
  constructor(readonly code: 'locked' | 'storage_unavailable' | 'invalid_record' | 'invalid_request') {
    super(code); this.name = 'PortfolioVaultLocalError';
  }
}

function validRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}
function parse(value: unknown, ownerId: string, slot: Slot): StoredSlot {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    const row = value as Record<string, unknown>;
    if (Object.keys(row).length !== 5 || row.ownerId !== ownerId || row.slot !== slot
      || typeof row.token !== 'string' || !/^[0-9a-f-]{36}$/.test(row.token) || !validRevision(row.revision)) throw new Error();
    return { ownerId, slot, token: row.token, revision: row.revision, record: parseEncryptedPortfolioRecord(row.record) };
  } catch { throw new PortfolioVaultLocalError('invalid_record'); }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new PortfolioVaultLocalError('storage_unavailable')); return; }
    let abandoned = false;
    const request = indexedDB.open(PORTFOLIO_VAULT_DB, 1);
    const timer = setTimeout(() => {
      abandoned = true; reject(new PortfolioVaultLocalError('storage_unavailable'));
    }, 5_000);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: ['ownerId', 'slot'] });
    request.onerror = () => { clearTimeout(timer); reject(new PortfolioVaultLocalError('storage_unavailable')); };
    request.onblocked = () => { abandoned = true; clearTimeout(timer); reject(new PortfolioVaultLocalError('storage_unavailable')); };
    request.onsuccess = () => {
      clearTimeout(timer);
      if (abandoned) request.result.close();
      else { request.result.onversionchange = () => request.result.close(); resolve(request.result); }
    };
  });
}

export class PortfolioVaultLocal {
  #key: PortfolioVaultKey | null;
  #transactions = new Set<IDBTransaction>();
  constructor(key: PortfolioVaultKey) { this.#key = key; }
  lock(): void {
    this.#key = null;
    for (const transaction of this.#transactions) {
      try { transaction.abort(); } catch { /* Already committed/aborted. */ }
    }
  }
  #active(): PortfolioVaultKey {
    if (!this.#key) throw new PortfolioVaultLocalError('locked');
    return this.#key;
  }
  async #transaction<T>(slot: Slot, mode: IDBTransactionMode,
    operation: (store: IDBObjectStore, stored: StoredSlot | null) => T,
  ): Promise<T> {
    const key = this.#active();
    let db: IDBDatabase;
    try { db = await openDatabase(); }
    catch { throw new PortfolioVaultLocalError('storage_unavailable'); }
    try {
      this.#active();
      return await new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        this.#transactions.add(transaction);
        const store = transaction.objectStore(STORE);
        let value: T;
        let failure: unknown;
        const get = store.get([key.ownerId, slot]);
        get.onsuccess = () => {
          try {
            this.#active();
            value = operation(store, get.result === undefined ? null : parse(get.result, key.ownerId, slot));
          } catch (error) { failure = error; transaction.abort(); }
        };
        transaction.oncomplete = () => {
          this.#transactions.delete(transaction);
          try { this.#active(); resolve(value); } catch (error) { reject(error); }
        };
        transaction.onabort = transaction.onerror = () => {
          this.#transactions.delete(transaction);
          reject(!this.#key ? new PortfolioVaultLocalError('locked') : failure instanceof PortfolioVaultLocalError
            ? failure : new PortfolioVaultLocalError('storage_unavailable'));
        };
      });
    } catch (error) {
      if (error instanceof PortfolioVaultLocalError) throw error;
      throw new PortfolioVaultLocalError('storage_unavailable');
    } finally { db.close(); }
  }

  async read(slot: Slot): Promise<OpenedVaultSlot | null> {
    const key = this.#active();
    const stored = await this.#transaction(slot, 'readonly', (_store, row) => row);
    this.#active();
    if (!stored) return null;
    const payload = await openPortfolioPayload(key, {
      ownerId: key.ownerId, purpose: slot, revision: stored.revision,
    }, stored.record);
    this.#active();
    return { token: stored.token, revision: stored.revision, payload };
  }

  /** revision is the server revision for cache, or intended next revision for outbox.
   * expectedToken comes from read(); null only means this slot was observed empty.
   */
  async write(slot: Slot, payload: PortfolioVaultPayload, revision: number, expectedToken: string | null): Promise<
    { status: 'ok'; token: string } | { status: 'conflict' }
  > {
    const key = this.#active();
    if (!validRevision(revision) || (expectedToken !== null && (typeof expectedToken !== 'string' || !/^[0-9a-f-]{36}$/.test(expectedToken)))) {
      throw new PortfolioVaultLocalError('invalid_request');
    }
    const record = await sealPortfolioPayload(key, { ownerId: key.ownerId, purpose: slot, revision }, payload);
    this.#active();
    const token = crypto.randomUUID();
    return this.#transaction(slot, 'readwrite', (store, stored) => {
      if (stored && stored.record.keyId !== key.id) throw new PortfolioVaultLocalError('invalid_record');
      if ((stored?.token ?? null) !== expectedToken || (stored && stored.revision > revision)) return { status: 'conflict' };
      store.put({ ownerId: key.ownerId, slot, token, revision, record } satisfies StoredSlot);
      return { status: 'ok', token };
    });
  }

  /** Acknowledgement must not remove edits queued while the request was in flight. */
  async acknowledgeOutbox(expectedToken: string): Promise<boolean> {
    const key = this.#active();
    return this.#transaction('outbox', 'readwrite', (store, stored) => {
      if (!stored || stored.token !== expectedToken) return false;
      store.delete([key.ownerId, 'outbox']);
      return true;
    });
  }
}
