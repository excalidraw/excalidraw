import type {
  IncrementsRepository,
  CLIENT_INCREMENT,
  SERVER_INCREMENT,
} from "../sync/protocol";

// CFDO: add senderId, possibly roomId as well
export class DurableIncrementsRepository implements IncrementsRepository {
  constructor(private storage: DurableObjectStorage) {
    // #region DEV ONLY
    // this.storage.sql.exec(`DROP TABLE IF EXISTS increments;`);
    // #endregion

    // CFDO: payload has just 2MB limit, which might not be enough
    this.storage.sql.exec(`CREATE TABLE IF NOT EXISTS increments(
			version		    INTEGER PRIMARY KEY AUTOINCREMENT,
			id            TEXT NOT NULL UNIQUE,
			createdAt	    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			payload		    TEXT
		);`);
  }

  public saveAll(increments: Array<CLIENT_INCREMENT>) {
    return this.storage.transactionSync(() => {
      const prevVersion = this.getLastVersion();
      const acknowledged: Array<SERVER_INCREMENT> = [];

      for (const increment of increments) {
        try {
          // unique id ensures that we don't acknowledge the same increment twice
          this.storage.sql.exec(
            `INSERT INTO increments (id, payload) VALUES (?, ?);`,
            increment.id,
            JSON.stringify(increment),
          );
        } catch (e) {
          // check if the increment has been already acknowledged
          // in case client for some reason did not receive acknowledgement
          // and reconnected while the we still have the increment in the worker
          // otherwise the client is doomed to full a restore
          if (
            e instanceof Error &&
            e.message.includes(
              "UNIQUE constraint failed: increments.id: SQLITE_CONSTRAINT",
            )
          ) {
            acknowledged.push(this.getById(increment.id));
            continue;
          }

          throw e;
        }
      }

      // query the just added increments
      acknowledged.push(...this.getSinceVersion(prevVersion));

      return acknowledged;
    });
  }

  public getSinceVersion(version: number): Array<SERVER_INCREMENT> {
    // CFDO: for versioning we need deletions, but not for the "snapshot" update;
    return this.storage.sql
      .exec<SERVER_INCREMENT>(
        `SELECT id, payload, version FROM increments WHERE version > (?) ORDER BY version, createdAt ASC;`,
        version,
      )
      .toArray();
  }

  public getLastVersion(): number {
    // CFDO: might be in memory to reduce number of rows read (or index on version at least, if btree affect rows read)
    const result = this.storage.sql
      .exec(`SELECT MAX(version) FROM increments;`)
      .one();

    return result ? Number(result["MAX(version)"]) : 0;
  }

  public getById(id: string): SERVER_INCREMENT {
    return this.storage.sql
      .exec<SERVER_INCREMENT>(
        `SELECT id, payload, version FROM increments WHERE id = (?)`,
        id,
      )
      .one();
  }
}
