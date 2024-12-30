import type {
  IncrementsRepository,
  CLIENT_INCREMENT,
  SERVER_INCREMENT,
} from "../sync/protocol";

// CFDO: add senderId, possibly roomId as well
export class DurableIncrementsRepository implements IncrementsRepository {
  // there is a 2MB row limit, hence working max row size of 1.5 MB
  // and leaving a buffer for other row metadata
  private static readonly MAX_PAYLOAD_SIZE = 1_500_000;

  constructor(private storage: DurableObjectStorage) {
    // #region DEV ONLY
    // this.storage.sql.exec(`DROP TABLE IF EXISTS increments;`);
    // #endregion

    this.storage.sql.exec(`CREATE TABLE IF NOT EXISTS increments(
			id            TEXT NOT NULL,
			version		    INTEGER NOT NULL,
      position      INTEGER NOT NULL,
			payload		    TEXT NOT NULL,
			createdAt	    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id, version, position)
		);`);
  }

  public save(increment: CLIENT_INCREMENT): SERVER_INCREMENT | null {
    return this.storage.transactionSync(() => {
      const existingIncrement = this.getById(increment.id);

      // don't perist the same increment twice
      if (existingIncrement) {
        return existingIncrement;
      }

      try {
        const payload = JSON.stringify(increment);
        const payloadSize = new TextEncoder().encode(payload).byteLength;
        const chunkVersion = this.getLastVersion() + 1;
        const chunksCount = Math.ceil(
          payloadSize / DurableIncrementsRepository.MAX_PAYLOAD_SIZE,
        );

        for (let position = 0; position < chunksCount; position++) {
          const start = position * DurableIncrementsRepository.MAX_PAYLOAD_SIZE;
          const end = start + DurableIncrementsRepository.MAX_PAYLOAD_SIZE;
          // slicing the chunk payload
          const chunkedPayload = payload.slice(start, end);

          this.storage.sql.exec(
            `INSERT INTO increments (id, version, position, payload) VALUES (?, ?, ?, ?);`,
            increment.id,
            chunkVersion,
            position,
            chunkedPayload,
          );
        }
      } catch (e) {
        // check if the increment has been already acknowledged
        // in case client for some reason did not receive acknowledgement
        // and reconnected while the we still have the increment in the worker
        // otherwise the client is doomed to full a restore
        if (e instanceof Error && e.message.includes("SQLITE_CONSTRAINT")) {
          // continue;
        } else {
          throw e;
        }
      }

      const acknowledged = this.getById(increment.id);
      return acknowledged;
    });
  }

  // CFDO: for versioning we need deletions, but not for the "snapshot" update;
  public getAllSinceVersion(version: number): Array<SERVER_INCREMENT> {
    const increments = this.storage.sql
      .exec<SERVER_INCREMENT>(
        `SELECT id, payload, version FROM increments WHERE version > (?) ORDER BY version, position, createdAt ASC;`,
        version,
      )
      .toArray();

    return this.restoreServerIncrements(increments);
  }

  public getLastVersion(): number {
    // CFDO: might be in memory to reduce number of rows read (or position on version at least, if btree affect rows read)
    const result = this.storage.sql
      .exec(`SELECT MAX(version) FROM increments;`)
      .one();

    return result ? Number(result["MAX(version)"]) : 0;
  }

  public getById(id: string): SERVER_INCREMENT | null {
    const increments = this.storage.sql
      .exec<SERVER_INCREMENT>(
        `SELECT id, payload, version FROM increments WHERE id = (?) ORDER BY position ASC`,
        id,
      )
      .toArray();

    if (!increments.length) {
      return null;
    }

    const restoredIncrements = this.restoreServerIncrements(increments);

    if (restoredIncrements.length !== 1) {
      throw new Error(
        `Expected exactly one restored increment, but received "${restoredIncrements.length}".`,
      );
    }

    return restoredIncrements[0];
  }

  private restoreServerIncrements(
    increments: SERVER_INCREMENT[],
  ): SERVER_INCREMENT[] {
    return Array.from(
      increments
        .reduce((acc, curr) => {
          const increment = acc.get(curr.version);

          if (increment) {
            acc.set(curr.version, {
              ...increment,
              // glueing the chunks payload back
              payload: increment.payload + curr.payload,
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
        }, new Map<number, SERVER_INCREMENT>())
        .values(),
    );
  }
}
