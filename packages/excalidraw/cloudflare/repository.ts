import type {
  DeltasRepository,
  CLIENT_DELTA,
  SERVER_DELTA,
  SERVER_DELTA_STORAGE,
} from "../sync/protocol";
import { Network } from "../sync/utils";

// CFDO II: add senderId, possibly roomId as well
export class DurableDeltasRepository implements DeltasRepository {
  // there is a 2MB row limit, hence working with max payload size of 1.5 MB
  // and leaving a ~500kB buffer for other row metadata
  private static readonly MAX_PAYLOAD_SIZE = 1_500_000;

  constructor(private storage: DurableObjectStorage) {
    // #region DEV ONLY
    // this.storage.sql.exec(`DROP TABLE IF EXISTS deltas;`);
    // #endregion

    this.storage.sql.exec(`CREATE TABLE IF NOT EXISTS deltas(
			id            TEXT NOT NULL,
			version		    INTEGER NOT NULL,
      position      INTEGER NOT NULL,
			payload		    BLOB NOT NULL,
			createdAt	    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id, version, position)
		);`);
  }

  public save(delta: CLIENT_DELTA): SERVER_DELTA | null {
    return this.storage.transactionSync(() => {
      const existingDelta = this.getById(delta.id);

      // don't perist the same delta twice
      if (existingDelta) {
        return existingDelta;
      }

      try {
        const payloadBuffer = Network.toBinary(delta);
        const payloadSize = payloadBuffer.byteLength;
        const nextVersion = this.getLastVersion() + 1;
        const chunksCount = Math.ceil(
          payloadSize / DurableDeltasRepository.MAX_PAYLOAD_SIZE,
        );

        for (let position = 0; position < chunksCount; position++) {
          const start = position * DurableDeltasRepository.MAX_PAYLOAD_SIZE;
          const end = start + DurableDeltasRepository.MAX_PAYLOAD_SIZE;
          const chunkedPayload = payloadBuffer.subarray(start, end);

          this.storage.sql.exec(
            `INSERT INTO deltas (id, version, position, payload) VALUES (?, ?, ?, ?);`,
            delta.id,
            nextVersion,
            position,
            chunkedPayload,
          );
        }
      } catch (e) {
        // check if the delta has been already acknowledged
        // in case client for some reason did not receive acknowledgement
        // and reconnected while the we still have the delta in the worker
        // otherwise the client is doomed to full a restore
        if (e instanceof Error && e.message.includes("SQLITE_CONSTRAINT")) {
          // continue;
        } else {
          throw e;
        }
      }

      const acknowledged = this.getById(delta.id);
      return acknowledged;
    });
  }

  // CFDO: for versioning we need deletions, but not for the "snapshot" update;
  public getAllSinceVersion(version: number): Array<SERVER_DELTA> {
    const deltas = this.storage.sql
      .exec<SERVER_DELTA_STORAGE>(
        `SELECT id, payload, version, position FROM deltas WHERE version > (?) ORDER BY version, position, createdAt ASC;`,
        version,
      )
      .toArray();

    return this.restorePayloadChunks(deltas);
  }

  public getLastVersion(): number {
    // CFDO: might be in memory to reduce number of rows read (or position on version at least, if btree affect rows read)
    const result = this.storage.sql
      .exec(`SELECT MAX(version) FROM deltas;`)
      .one();

    return result ? Number(result["MAX(version)"]) : 0;
  }

  public getById(id: string): SERVER_DELTA | null {
    const deltas = this.storage.sql
      .exec<SERVER_DELTA_STORAGE>(
        `SELECT id, payload, version, position FROM deltas WHERE id = (?) ORDER BY position ASC`,
        id,
      )
      .toArray();

    if (!deltas.length) {
      return null;
    }

    const restoredDeltas = this.restorePayloadChunks(deltas);

    if (restoredDeltas.length !== 1) {
      throw new Error(
        `Expected exactly one restored delta, but received "${restoredDeltas.length}".`,
      );
    }

    return restoredDeltas[0];
  }

  private restorePayloadChunks(
    deltas: Array<SERVER_DELTA_STORAGE>,
  ): Array<SERVER_DELTA> {
    return Array.from(
      deltas
        .reduce((acc, curr) => {
          const delta = acc.get(curr.version);

          if (delta) {
            const currentPayload = new Uint8Array(curr.payload);
            acc.set(curr.version, {
              ...delta,
              // glueing the chunks payload back
              payload: Uint8Array.from([...delta.payload, ...currentPayload]),
            });
          } else {
            // let's not unnecessarily expose more props than these (i.e. position)
            acc.set(curr.version, {
              id: curr.id,
              version: curr.version,
              payload: new Uint8Array(curr.payload),
            });
          }

          return acc;
          // using Uint8Array instead of ArrayBuffer, as it has nicer methods
        }, new Map<number, Omit<SERVER_DELTA_STORAGE, "payload" | "position"> & { payload: Uint8Array }>())
        .values(),
    ).map((delta) => ({
      ...delta,
      payload: Network.fromBinary(delta.payload),
    }));
  }
}
