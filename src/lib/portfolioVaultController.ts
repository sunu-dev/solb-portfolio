/**
 * Staged encrypted sync workflow. No production component imports this yet.
 * Edits are acknowledged only after encrypted local persistence; an ambiguous
 * cloud response is reconciled against a fresh decrypted read before retrying.
 */
import { PortfolioVaultLocal, type OpenedVaultSlot } from './portfolioVaultLocal';
import { unlockPasskeyPortfolioVault } from './portfolioVaultPasskey';
import { PortfolioVaultSession, readPortfolioVault, type PortfolioVaultRpc, type SealedPortfolio } from './portfolioVaultSync';
import { normalizePortfolioVaultPayload, portfolioVaultPayloadSignature, type PortfolioVaultPayload } from './portfolioVaultPayload';
import type { PortfolioVaultKey } from './portfolioVaultCrypto';

export type PortfolioVaultView =
  | { status: 'locked' | 'opening' | 'unavailable' | 'needs-enrollment' | 'disabled' }
  | { status: 'ready' | 'pending' | 'saving' | 'unsynced'; payload: PortfolioVaultPayload }
  | { status: 'conflict'; payload: PortfolioVaultPayload; remote: PortfolioVaultPayload };

type Unlock = (userId: string, stored: SealedPortfolio, signal: AbortSignal) => Promise<PortfolioVaultKey>;
const unlock: Unlock = (userId, stored, signal) => unlockPasskeyPortfolioVault(userId, stored.protectedKey, stored.descriptor, signal);

export class PortfolioVaultControllerError extends Error {
  constructor(readonly code: 'busy' | 'locked' | 'not_ready' | 'local_conflict' | 'invalid_payload' | 'unavailable') {
    super(code); this.name = 'PortfolioVaultControllerError';
  }
}

export class PortfolioVaultController {
  #view: PortfolioVaultView = { status: 'locked' };
  #listeners = new Set<() => void>();
  #local: PortfolioVaultLocal | null = null;
  #session: PortfolioVaultSession | null = null;
  #outbox: OpenedVaultSlot | null = null;
  #cache: OpenedVaultSlot | null = null;
  #epoch = 0;
  #busy = false;
  #localTail: Promise<unknown> = Promise.resolve();
  #abort = new AbortController();

  constructor(private readonly rpc: PortfolioVaultRpc, private readonly unlockKey: Unlock = unlock) {}
  getSnapshot = (): PortfolioVaultView => this.#view;
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };
  #publish(view: PortfolioVaultView): void {
    this.#view = view;
    for (const listener of this.#listeners) listener();
  }
  lock(): void {
    this.#epoch++;
    this.#abort.abort();
    this.#abort = new AbortController();
    this.#session?.lock();
    this.#local?.lock();
    this.#session = null; this.#local = null; this.#outbox = null; this.#cache = null;
    this.#busy = false;
    this.#localTail = Promise.resolve();
    this.#publish({ status: 'locked' });
  }
  #current(epoch: number): void {
    if (epoch !== this.#epoch) throw new PortfolioVaultControllerError('locked');
  }
  #start(): number {
    if (this.#busy) throw new PortfolioVaultControllerError('busy');
    this.#busy = true;
    return this.#epoch;
  }
  #finish(epoch: number): void { if (epoch === this.#epoch) this.#busy = false; }
  #locally<T>(epoch: number, work: () => Promise<T>): Promise<T> {
    const pending = this.#localTail.then(() => { this.#current(epoch); return work(); });
    this.#localTail = pending.catch(() => undefined);
    return pending;
  }

  async open(userId: string): Promise<void> {
    if (this.#busy) throw new PortfolioVaultControllerError('busy');
    this.lock();
    const epoch = this.#start();
    this.#publish({ status: 'opening' });
    try {
      const stored = await readPortfolioVault(this.rpc, userId);
      this.#current(epoch);
      if (stored.status !== 'sealed') { this.#publish({ status: 'needs-enrollment' }); return; }
      const key = await this.unlockKey(userId, stored, this.#abort.signal);
      this.#current(epoch);
      if (key.ownerId !== userId) throw new PortfolioVaultControllerError('unavailable');
      this.#local = new PortfolioVaultLocal(key);
      this.#session = new PortfolioVaultSession(key, this.rpc);
      const [cache, outbox] = await Promise.all([this.#local.read('backup'), this.#local.read('outbox')]);
      this.#current(epoch);
      this.#cache = cache; this.#outbox = outbox;
      await this.#reconcile(epoch);
    } catch (error) {
      if (epoch === this.#epoch) {
        this.#session?.lock(); this.#local?.lock();
        this.#session = null; this.#local = null; this.#cache = null; this.#outbox = null;
        this.#publish({ status: 'unavailable' });
      }
      throw error;
    } finally { this.#finish(epoch); }
  }

  async #cacheRemote(epoch: number, payload: PortfolioVaultPayload, revision: number): Promise<void> {
    this.#current(epoch);
    if (!this.#local) throw new PortfolioVaultControllerError('locked');
    const saved = await this.#local.write('backup', payload, revision, this.#cache?.token ?? null);
    this.#current(epoch);
    if (saved.status !== 'ok') throw new PortfolioVaultControllerError('local_conflict');
    this.#cache = { token: saved.token, revision, payload };
  }

  async #acknowledge(epoch: number): Promise<void> {
    this.#current(epoch);
    if (!this.#local || !this.#outbox) throw new PortfolioVaultControllerError('locked');
    const cleared = await this.#local.acknowledgeOutbox(this.#outbox.token);
    this.#current(epoch);
    if (!cleared) throw new PortfolioVaultControllerError('local_conflict');
    this.#outbox = null;
  }

  async #reconcile(epoch: number): Promise<void> {
    this.#current(epoch);
    if (!this.#session) throw new PortfolioVaultControllerError('locked');
    const remote = await this.#session.load(this.#cache?.revision ?? 1);
    this.#current(epoch);
    const revision = this.#session.currentRevision!;
    await this.#locally(epoch, async () => {
      // Snapshot/acknowledgement and edits share a local queue; network waits do
      // not hold it. Never acknowledge a newer edit based on an older response.
      await this.#cacheRemote(epoch, remote, revision);
      const pending = this.#outbox;
      if (!pending) { this.#publish({ status: 'ready', payload: remote }); return; }
      if (revision >= pending.revision && portfolioVaultPayloadSignature(remote) === portfolioVaultPayloadSignature(pending.payload)) {
        await this.#acknowledge(epoch);
        this.#publish({ status: 'ready', payload: remote });
      } else if (pending.revision === revision + 1) {
        this.#publish({ status: 'pending', payload: pending.payload });
      } else {
        this.#publish({ status: 'conflict', payload: pending.payload, remote });
      }
    });
  }

  async edit(input: PortfolioVaultPayload): Promise<void> {
    if (!this.#local || !this.#cache || !['ready', 'pending', 'unsynced', 'saving', 'disabled'].includes(this.#view.status)) {
      throw new PortfolioVaultControllerError('not_ready');
    }
    const payload = normalizePortfolioVaultPayload(input);
    if (!payload) throw new PortfolioVaultControllerError('invalid_payload');
    if ('payload' in this.#view && this.#view.payload.privateState && !payload.privateState) {
      throw new PortfolioVaultControllerError('invalid_payload');
    }
    const epoch = this.#epoch;
    await this.#locally(epoch, async () => {
      if (!this.#local || !this.#cache || !['ready', 'pending', 'unsynced', 'saving', 'disabled'].includes(this.#view.status)) {
        throw new PortfolioVaultControllerError('not_ready');
      }
      const revision = this.#outbox?.revision ?? this.#cache.revision + 1;
      const saved = await this.#local.write('outbox', payload, revision, this.#outbox?.token ?? null);
      this.#current(epoch);
      if (saved.status !== 'ok') throw new PortfolioVaultControllerError('local_conflict');
      this.#outbox = { token: saved.token, revision, payload };
      this.#publish(this.#view.status === 'disabled' ? { status: 'disabled' } : { status: 'pending', payload });
    });
  }

  async flush(): Promise<void> {
    if (!this.#session || !this.#local || !this.#outbox || !['pending', 'unsynced'].includes(this.#view.status)) {
      throw new PortfolioVaultControllerError('not_ready');
    }
    const epoch = this.#start();
    try {
      // Re-read after every ambiguous failure/restart before making a CAS write.
      await this.#reconcile(epoch);
      this.#current(epoch);
      const pending = await this.#locally(epoch, async () => {
        if (this.#view.status !== 'pending' || !this.#outbox) return null;
        const snapshot = this.#outbox;
        this.#publish({ status: 'saving', payload: snapshot.payload });
        return snapshot;
      });
      if (!pending) return;
      const saved = await this.#session.save(pending.payload);
      this.#current(epoch);
      if (saved.status === 'disabled') {
        // Close the reader/network first. Keep the local encryption capability
        // until the runtime drains edits already accepted by the UI, then lock.
        // A write kill switch must not destroy an edit queued during its reply.
        this.#session?.lock(); this.#session = null;
        this.#publish({ status: 'disabled' });
        return;
      }
      if (saved.status === 'conflict') { await this.#reconcile(epoch); return; }
      await this.#locally(epoch, async () => {
        await this.#cacheRemote(epoch, pending.payload, saved.revision);
        if (!this.#outbox || !this.#local) throw new PortfolioVaultControllerError('local_conflict');
        if (this.#outbox.token === pending.token) {
          await this.#acknowledge(epoch);
          this.#publish({ status: 'ready', payload: pending.payload });
        } else {
          // A newer local edit was stored while this request was in flight.
          // Rebase that exact edit onto the confirmed revision, never delete it.
          const newer = this.#outbox;
          const rebased = await this.#local.write('outbox', newer.payload, saved.revision + 1, newer.token);
          this.#current(epoch);
          if (rebased.status !== 'ok') throw new PortfolioVaultControllerError('local_conflict');
          this.#outbox = { token: rebased.token, revision: saved.revision + 1, payload: newer.payload };
          this.#publish({ status: 'pending', payload: newer.payload });
        }
      });
    } catch (error) {
      if (epoch === this.#epoch && this.#outbox) this.#publish({ status: 'unsynced', payload: this.#outbox.payload });
      throw error;
    } finally { this.#finish(epoch); }
  }

  /** Explicit user choice only; never automatically merges conflicting records. */
  async resolveConflict(choice: 'local' | 'remote'): Promise<void> {
    if (this.#view.status !== 'conflict' || !this.#local || !this.#cache || !this.#outbox) {
      throw new PortfolioVaultControllerError('not_ready');
    }
    const epoch = this.#start();
    try {
      await this.#locally(epoch, async () => {
        if (!this.#cache || !this.#outbox || !this.#local) throw new PortfolioVaultControllerError('not_ready');
        if (choice === 'remote') {
          await this.#acknowledge(epoch);
          this.#publish({ status: 'ready', payload: this.#cache.payload });
        } else {
          const payload = this.#outbox.payload;
          const revision = this.#cache.revision + 1;
          const saved = await this.#local.write('outbox', payload, revision, this.#outbox.token);
          this.#current(epoch);
          if (saved.status !== 'ok') throw new PortfolioVaultControllerError('local_conflict');
          this.#outbox = { token: saved.token, revision, payload };
          this.#publish({ status: 'pending', payload });
        }
      });
    } finally { this.#finish(epoch); }
  }
}
