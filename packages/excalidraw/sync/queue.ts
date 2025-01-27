import throttle from "lodash.throttle";
import type { StoreDelta } from "../store";

export interface DeltasRepository {
  loadDeltas(): Promise<Array<StoreDelta> | null>;
  saveDeltas(params: StoreDelta[]): Promise<void>;
}

export interface MetadataRepository {
  loadMetadata(): Promise<{ lastAcknowledgedVersion: number } | null>;
  saveMetadata(metadata: { lastAcknowledgedVersion: number }): Promise<void>;
}

export class LocalDeltasQueue {
  private readonly queue: Map<string, StoreDelta>;
  private readonly repository: DeltasRepository;

  private constructor(
    queue: Map<string, StoreDelta> = new Map(),
    repository: DeltasRepository,
  ) {
    this.queue = queue;
    this.repository = repository;
  }

  public static async create(repository: DeltasRepository) {
    const deltas = await repository.loadDeltas();

    return new LocalDeltasQueue(
      new Map(deltas?.map((delta) => [delta.id, delta])),
      repository,
    );
  }

  public getAll() {
    return Array.from(this.queue.values());
  }

  public get(id: StoreDelta["id"]) {
    return this.queue.get(id);
  }

  public has(id: StoreDelta["id"]) {
    return this.queue.has(id);
  }

  public add(...deltas: StoreDelta[]) {
    for (const delta of deltas) {
      this.queue.set(delta.id, delta);
    }

    this.persist();
  }

  public remove(...ids: StoreDelta["id"][]) {
    for (const id of ids) {
      this.queue.delete(id);
    }

    this.persist();
  }

  public persist = throttle(
    async () => {
      try {
        await this.repository.saveDeltas(this.getAll());
      } catch (e) {
        console.error("Failed to persist the sync queue:", e);
      }
    },
    1000,
    { leading: false, trailing: true },
  );
}
