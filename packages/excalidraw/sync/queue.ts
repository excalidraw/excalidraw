import throttle from "lodash.throttle";
import type { StoreIncrement } from "../store";

export interface IncrementsRepository {
  loadIncrements(): Promise<Array<StoreIncrement> | null>;
  saveIncrements(params: StoreIncrement[]): Promise<void>;
}

export interface MetadataRepository {
  loadMetadata(): Promise<{ lastAcknowledgedVersion: number } | null>;
  saveMetadata(metadata: { lastAcknowledgedVersion: number }): Promise<void>;
}

// CFDO: make sure the increments are always acknowledged (deleted from the repository)
export class SyncQueue {
  private readonly queue: Map<string, StoreIncrement>;
  private readonly repository: IncrementsRepository;

  private constructor(
    queue: Map<string, StoreIncrement> = new Map(),
    repository: IncrementsRepository,
  ) {
    this.queue = queue;
    this.repository = repository;
  }

  public static async create(repository: IncrementsRepository) {
    const increments = await repository.loadIncrements();

    return new SyncQueue(
      new Map(increments?.map((increment) => [increment.id, increment])),
      repository,
    );
  }

  public getAll() {
    return Array.from(this.queue.values());
  }

  public get(id: StoreIncrement["id"]) {
    return this.queue.get(id);
  }

  public has(id: StoreIncrement["id"]) {
    return this.queue.has(id);
  }

  public add(...increments: StoreIncrement[]) {
    for (const increment of increments) {
      this.queue.set(increment.id, increment);
    }

    this.persist();
  }

  public remove(...ids: StoreIncrement["id"][]) {
    for (const id of ids) {
      this.queue.delete(id);
    }

    this.persist();
  }

  public persist = throttle(
    async () => {
      try {
        await this.repository.saveIncrements(this.getAll());
      } catch (e) {
        console.error("Failed to persist the sync queue:", e);
      }
    },
    1000,
    { leading: false, trailing: true },
  );
}
