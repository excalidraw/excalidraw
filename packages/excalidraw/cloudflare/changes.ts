import type {
  ChangesRepository,
  CLIENT_CHANGE,
  SERVER_CHANGE,
} from "../sync/protocol";

// TODO: add senderId, possibly roomId as well
export class DurableChangesRepository implements ChangesRepository {
  constructor(private storage: DurableObjectStorage) {
    // #region DEV ONLY
    // this.storage.sql.exec(`DROP TABLE IF EXISTS changes;`);
    // #endregion

    this.storage.sql.exec(`CREATE TABLE IF NOT EXISTS changes(
			id			TEXT PRIMARY KEY,
			payload		TEXT NOT NULL,
			version		INTEGER NOT NULL DEFAULT 1,
			createdAt	TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`);
  }

  public saveAll = (changes: Array<CLIENT_CHANGE>) =>
    this.storage.transactionSync(() => {
      const prevVersion = this.getLastVersion();
      const nextVersion = prevVersion + changes.length;

      // TODO: in theory payload could contain array of changes, if we would need to optimize writes
      for (const [index, change] of changes.entries()) {
        const version = prevVersion + index + 1;
        // unique id ensures that we don't acknowledge the same change twice
        this.storage.sql.exec(
          `INSERT INTO changes (id, payload, version) VALUES (?, ?, ?);`,
          change.id,
          JSON.stringify(change),
          version,
        );
      }

      // sanity check
      if (nextVersion !== this.getLastVersion()) {
        throw new Error(
          `Expected last acknowledged version to be "${nextVersion}", but it is "${this.getLastVersion()}!"`,
        );
      }

      return this.getSinceVersion(prevVersion);
    });

  public getSinceVersion = (version: number): Array<SERVER_CHANGE> =>
    this.storage.sql
      .exec<SERVER_CHANGE>(
        `SELECT id, payload, version FROM changes WHERE version > (?) ORDER BY version ASC;`,
        version,
      )
      .toArray();

  public getLastVersion = (): number => {
    const result = this.storage.sql
      .exec(`SELECT MAX(version) FROM changes;`)
      .one();

    return result ? Number(result["MAX(version)"]) : 0;
  };
}
