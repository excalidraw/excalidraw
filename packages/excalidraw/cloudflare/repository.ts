import type { DeltasRepository, DELTA, SERVER_DELTA } from "../sync/protocol";

// CFDO: add senderId, possibly roomId as well
export class DurableDeltasRepository implements DeltasRepository {
  // there is a 2MB row limit, hence working max row size of 1.5 MB
  // and leaving a buffer for other row metadata
  private static readonly MAX_PAYLOAD_SIZE = 1_500_000;

  constructor(private storage: DurableObjectStorage) {
    // #region DEV ONLY
    // this.storage.sql.exec(`DROP TABLE IF EXISTS deltas;`);
    // #endregion

    this.storage.sql.exec(`CREATE TABLE IF NOT EXISTS deltas(
			id            TEXT NOT NULL,
			version		    INTEGER NOT NULL,
      position      INTEGER NOT NULL,
			payload		    TEXT NOT NULL,
			createdAt	    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id, version, position)
		);`);
  }

  public save(delta: DELTA): SERVER_DELTA | null {
    return this.storage.transactionSync(() => {
      const existingDelta = this.getById(delta.id);

      // don't perist the same delta twice
      if (existingDelta) {
        return existingDelta;
      }

      try {
        // CFDO: could be also a buffer
        const payload = JSON.stringify(delta);
        const payloadSize = new TextEncoder().encode(payload).byteLength;
        const nextVersion = this.getLastVersion() + 1;
        const chunksCount = Math.ceil(
          payloadSize / DurableDeltasRepository.MAX_PAYLOAD_SIZE,
        );

        for (let position = 0; position < chunksCount; position++) {
          const start = position * DurableDeltasRepository.MAX_PAYLOAD_SIZE;
          const end = start + DurableDeltasRepository.MAX_PAYLOAD_SIZE;
          // slicing the chunk payload
          const chunkedPayload = payload.slice(start, end);

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
      .exec<SERVER_DELTA>(
        `SELECT id, payload, version FROM deltas WHERE version > (?) ORDER BY version, position, createdAt ASC;`,
        version,
      )
      .toArray();

    return this.restoreServerDeltas(deltas);
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
      .exec<SERVER_DELTA>(
        `SELECT id, payload, version FROM deltas WHERE id = (?) ORDER BY position ASC`,
        id,
      )
      .toArray();

    if (!deltas.length) {
      return null;
    }

    const restoredDeltas = this.restoreServerDeltas(deltas);

    if (restoredDeltas.length !== 1) {
      throw new Error(
        `Expected exactly one restored delta, but received "${restoredDeltas.length}".`,
      );
    }

    return restoredDeltas[0];
  }

  // CFDO: fix types (should be buffer in the first place)
  private restoreServerDeltas(deltas: SERVER_DELTA[]): SERVER_DELTA[] {
    return Array.from(
      deltas
        .reduce((acc, curr) => {
          const delta = acc.get(curr.version);

          if (delta) {
            acc.set(curr.version, {
              ...delta,
              // glueing the chunks payload back
              payload: delta.payload + curr.payload,
            });
          } else {
            // let's not unnecessarily expose more props than these
            acc.set(curr.version, {
              id: curr.id,
              version: curr.version,
              payload: curr.payload,
            });
          }

          return acc;
        }, new Map<number, SERVER_DELTA>())
        .values(),
    // CFDO: temporary
    ).map((delta) => ({
      ...delta,
      payload: JSON.parse(delta.payload),
    }));
  }
}
