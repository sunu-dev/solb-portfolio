/** Bridges synchronous UI edits to asynchronous encrypted persistence. No raw
 * portfolio is written here. A local write must finish before a safe hand-off;
 * cloud requests never hold that hand-off hostage.
 */
import type { PortfolioVaultController, PortfolioVaultView } from './portfolioVaultController';
import { normalizePortfolioVaultPayload, portfolioVaultPayloadSignature, type PortfolioVaultPayload } from './portfolioVaultPayload';

export interface PortfolioVaultRuntimeView {
  status: PortfolioVaultView['status'];
  localPending: boolean;
  localError: boolean;
  closing: boolean;
}
export interface PortfolioVaultStorePort {
  read(): { ownerId: string | null; payload: PortfolioVaultPayload };
  subscribe(listener: () => void): () => void;
  apply(ownerId: string, payload: PortfolioVaultPayload): void;
  status(ownerId: string, view: PortfolioVaultRuntimeView): void;
  clear(ownerId: string): void;
}
export class PortfolioVaultRuntimeError extends Error {
  constructor(readonly code: 'closed' | 'local_save_failed' | 'wrong_owner' | 'unsupported_record' | 'read_only') {
    super(code); this.name = 'PortfolioVaultRuntimeError';
  }
}
type Controller = Pick<PortfolioVaultController, 'open' | 'lock' | 'edit' | 'flush' | 'resolveConflict' | 'getSnapshot' | 'subscribe'>;

export class PortfolioVaultRuntime {
  #view: PortfolioVaultRuntimeView = { status: 'locked', localPending: false, localError: false, closing: false };
  #listeners = new Set<() => void>();
  #pending: PortfolioVaultPayload | null = null;
  #acceptedSignature = '';
  #processing: Promise<void> | null = null;
  #cloud: Promise<void> | null = null;
  #handoff: Promise<void> | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #applying = false;
  #closed = false;
  #opened = false;
  #unsubscribeStore: () => void;
  #unsubscribeController: () => void;

  constructor(readonly ownerId: string, private readonly controller: Controller,
    private readonly store: PortfolioVaultStorePort, private readonly debounceMs = 2_000,
    private readonly readOnly = false) {
    this.#unsubscribeStore = store.subscribe(() => this.#capture());
    this.#unsubscribeController = controller.subscribe(() => this.#observeController());
  }
  getSnapshot = (): PortfolioVaultRuntimeView => this.#view;
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener); return () => this.#listeners.delete(listener);
  };
  #publish(patch: Partial<PortfolioVaultRuntimeView>): void {
    this.#view = { ...this.#view, ...patch };
    const wasApplying = this.#applying;
    this.#applying = true;
    try { this.store.status(this.ownerId, this.#view); }
    finally { this.#applying = wasApplying; }
    for (const listener of this.#listeners) listener();
  }
  #apply(payload: PortfolioVaultPayload): void {
    if (!payload.privateState) throw new PortfolioVaultRuntimeError('unsupported_record');
    const state = this.store.read();
    if (state.ownerId !== this.ownerId) throw new PortfolioVaultRuntimeError('wrong_owner');
    this.#acceptedSignature = portfolioVaultPayloadSignature(payload);
    this.#applying = true;
    try { this.store.apply(this.ownerId, payload); }
    finally { this.#applying = false; }
  }
  #observeController(): void {
    if (this.#closed) return;
    const next = this.controller.getSnapshot();
    // A controller response may describe an older edit. Until the newest UI
    // change is durable it must not replace that change in the visible store.
    if (!this.#view.closing && !this.#view.localPending && 'payload' in next) {
      try { this.#apply(next.payload); }
      catch { this.#publish({ status: 'unavailable', localError: true }); return; }
    }
    this.#publish({ status: next.status });
    if (next.status === 'disabled' && !this.#view.closing) void this.close().catch(() => undefined);
  }
  async open(): Promise<void> {
    if (this.#closed || this.#view.closing) throw new PortfolioVaultRuntimeError('closed');
    if (this.store.read().ownerId !== this.ownerId) throw new PortfolioVaultRuntimeError('wrong_owner');
    if (this.#opened) return;
    this.#publish({ status: 'opening' });
    await this.controller.open(this.ownerId);
    if (this.#closed || this.#view.closing) return;
    const opened = this.controller.getSnapshot();
    if ('payload' in opened) {
      if (!opened.payload.privateState) {
        this.controller.lock(); this.#publish({ status: 'unavailable' });
        throw new PortfolioVaultRuntimeError('unsupported_record');
      }
      this.#apply(opened.payload);
      this.#opened = true;
      this.#schedule();
    }
  }
  #capture(): void {
    if (this.readOnly) return;
    if (this.#closed || this.#view.closing || this.#applying || !this.#opened) return;
    const state = this.store.read();
    if (state.ownerId !== this.ownerId) {
      this.#publish({ closing: true, localError: true });
      return;
    }
    let payload: PortfolioVaultPayload | null;
    let signature: string;
    try {
      payload = normalizePortfolioVaultPayload(state.payload);
      if (!payload?.privateState) throw new Error();
      signature = portfolioVaultPayloadSignature(payload);
    } catch { this.#publish({ localPending: true, localError: true }); return; }
    if (signature === this.#acceptedSignature) return;
    this.#acceptedSignature = signature;
    this.#pending = payload;
    // Same call stack as the Zustand mutation: never show "saved" first.
    this.#publish({ localPending: true });
    if (!this.#view.localError) void this.#drain().catch(() => undefined);
  }
  #drain(): Promise<void> {
    if (this.#processing) return this.#processing;
    if (!this.#pending) {
      return this.#view.localError ? Promise.reject(new PortfolioVaultRuntimeError('local_save_failed')) : Promise.resolve();
    }
    this.#publish({ localError: false });
    const run = async () => {
      while (this.#pending) {
        const payload = this.#pending;
        this.#pending = null;
        try { await this.controller.edit(payload); }
        catch {
          // Keep the newest complete edit in memory for an explicit retry. The
          // previous durable ciphertext remains untouched on transaction error.
          if (!this.#pending) this.#pending = payload;
          this.#publish({ localPending: true, localError: true });
          throw new PortfolioVaultRuntimeError('local_save_failed');
        }
      }
      this.#publish({ localPending: false, localError: false });
      this.#observeController();
    };
    const pending = run();
    this.#processing = pending;
    void pending.finally(() => {
      if (this.#processing === pending) this.#processing = null;
      if (!this.#view.localError) this.#schedule();
    }).catch(() => undefined);
    return pending;
  }
  async saveLocally(): Promise<void> {
    if (this.#closed) throw new PortfolioVaultRuntimeError('closed');
    await this.#drain();
    // An edit may arrive as the prior drain completes; include it in hand-off.
    if (this.#pending) await this.#drain();
    if (this.#view.localPending || this.#view.localError) throw new PortfolioVaultRuntimeError('local_save_failed');
  }
  #schedule(): void {
    if (this.readOnly) return;
    if (this.#closed || this.#view.closing || this.#cloud || this.#view.localPending || this.#view.localError) return;
    if (!['pending', 'unsynced'].includes(this.controller.getSnapshot().status)) return;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => { this.#timer = null; void this.flush().catch(() => undefined); }, this.debounceMs);
  }
  flush(): Promise<void> {
    if (this.readOnly) return Promise.resolve();
    if (this.#cloud) return this.#cloud;
    const run = async () => {
      await this.saveLocally();
      if (this.#closed || this.#view.closing) return;
      if (['pending', 'unsynced'].includes(this.controller.getSnapshot().status)) await this.controller.flush();
    };
    const pending = run();
    this.#cloud = pending;
    void pending.then(() => {
      if (this.#cloud === pending) this.#cloud = null;
      this.#schedule();
    }, () => { if (this.#cloud === pending) this.#cloud = null; });
    return pending;
  }
  async resolveConflict(choice: 'local' | 'remote'): Promise<void> {
    if (this.readOnly) throw new PortfolioVaultRuntimeError('read_only');
    if (this.#closed || this.#view.closing) throw new PortfolioVaultRuntimeError('closed');
    if (this.#processing) await this.#processing.catch(() => undefined);
    if (choice === 'remote') { this.#pending = null; this.#publish({ localPending: false, localError: false }); }
    await this.controller.resolveConflict(choice);
    await this.saveLocally();
    this.#observeController(); this.#schedule();
  }
  close(): Promise<void> {
    if (this.#handoff) return this.#handoff;
    if (this.#closed) return Promise.resolve();
    this.#publish({ closing: true });
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    const finish = async () => {
      await this.saveLocally();
      this.#closed = true;
      this.#unsubscribeStore(); this.#unsubscribeController();
      this.controller.lock();
      this.#pending = null; this.#acceptedSignature = '';
      this.store.clear(this.ownerId);
      this.#publish({ status: 'locked', closing: true, localPending: false, localError: false });
    };
    const pending = finish();
    this.#handoff = pending;
    void pending.catch(() => {
      // Retain the key and edit behind the closed reader boundary so a storage
      // failure can be retried. Never sign out/reset while calling it "saved".
      if (this.#handoff === pending) this.#handoff = null;
      this.#publish({ localError: true });
    });
    return pending;
  }
}
