import { StoreDelta, ElementsDelta } from "@excalidraw/element";

import type { StoreSnapshot } from "@excalidraw/element";
import type {
  SceneElementsMap,
  ExcalidrawElement,
} from "@excalidraw/element/types";

export interface TransactionHandlers {
  getSnapshot: () => StoreSnapshot;
  handleRecord: (delta: StoreDelta) => void;
  getSceneElements: () => SceneElementsMap;
  handleRestore: (elements: readonly ExcalidrawElement[]) => void;
}

export interface TransactionHandle {
  commit(): void;
  rollback(): void;
}

export class Transaction {
  private _isActive = false;
  private preTransactionSnapshot: StoreSnapshot | null = null;
  private id = 0;

  public get isActive(): boolean {
    return this._isActive;
  }

  constructor(private readonly handlers: TransactionHandlers) {}

  public begin(): TransactionHandle {
    if (this._isActive) {
      throw new Error(
        "A transaction is already active. Call commit() or rollback() before starting a new one.",
      );
    }

    this._isActive = true;
    // StoreSnapshot.maybeClone always creates a new instance on change,
    // so this reference stays stable even as the store snapshot advances.
    this.preTransactionSnapshot = this.handlers.getSnapshot();
    ++this.id;

    this.log(`begin`);

    return {
      commit: () => this.commit(),
      rollback: () => this.rollback(),
    };
  }

  public commit(): void {
    this._isActive = false;

    const delta = this.computeDelta();
    if (delta) {
      this.handlers.handleRecord(delta);
      this.log(`commit`, { delta });
    } else {
      this.log(`commit (no changes)`);
    }
  }

  public rollback(): void {
    this._isActive = false;

    const delta = this.computeDelta();
    if (delta) {
      const inverse = StoreDelta.inverse(delta);
      const [nextElements] = inverse.elements.applyTo(
        this.handlers.getSceneElements(),
        undefined,
        {
          excludedProperties: new Set(["version", "versionNonce"]),
        },
      );
      this.handlers.handleRestore([...nextElements.values()]);
      this.log(`rollback`, { delta, inverse });
    } else {
      this.log(`rollback (no changes)`);
    }
  }

  private computeDelta(): StoreDelta | null {
    const preSnapshot = this.preTransactionSnapshot;
    if (!preSnapshot) {
      return null;
    }

    this.preTransactionSnapshot = null;
    const raw = StoreDelta.calculate(preSnapshot, this.handlers.getSnapshot());
    const updates = Object.entries(raw.elements.updated);

    // ElementsDelta.calculate places elements born and died within the transaction
    // (absent from preSnapshot, isDeleted: true in postSnapshot) into `updated`
    // with both sides isDeleted: true. These are invisible to the user and must
    // not produce an undo entry.
    const filteredUpdates = updates.filter(
      ([, d]) =>
        !(d.deleted.isDeleted === true && d.inserted.isDeleted === true),
    );
    if (filteredUpdates.length === updates.length) {
      return raw.isEmpty() ? null : raw;
    }

    const delta = StoreDelta.create(
      ElementsDelta.create(
        raw.elements.added,
        raw.elements.removed,
        Object.fromEntries(filteredUpdates),
      ),
      raw.appState,
    );

    return delta.isEmpty() ? null : delta;
  }

  private log(message: string, data?: unknown): void {
    if (window?.DEBUG_TRANSACTIONS) {
      // eslint-disable-next-line no-console
      console.log(`[Transaction#${this.id}] ${message}`, data);
    }
  }
}
