this.workbox = this.workbox || {};
this.workbox.backgroundSync = (function (exports, WorkboxError_mjs, logger_mjs, assert_mjs, getFriendlyURL_mjs, DBWrapper_mjs) {
  'use strict';

  try {
    self['workbox:background-sync:4.3.1'] && _();
  } catch (e) {} // eslint-disable-line

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  const DB_VERSION = 3;
  const DB_NAME = 'workbox-background-sync';
  const OBJECT_STORE_NAME = 'requests';
  const INDEXED_PROP = 'queueName';
  /**
   * A class to manage storing requests from a Queue in IndexedbDB,
   * indexed by their queue name for easier access.
   *
   * @private
   */

  class QueueStore {
    /**
     * Associates this instance with a Queue instance, so entries added can be
     * identified by their queue name.
     *
     * @param {string} queueName
     * @private
     */
    constructor(queueName) {
      this._queueName = queueName;
      this._db = new DBWrapper_mjs.DBWrapper(DB_NAME, DB_VERSION, {
        onupgradeneeded: this._upgradeDb
      });
    }
    /**
     * Append an entry last in the queue.
     *
     * @param {Object} entry
     * @param {Object} entry.requestData
     * @param {number} [entry.timestamp]
     * @param {Object} [entry.metadata]
     * @private
     */


    async pushEntry(entry) {
      {
        assert_mjs.assert.isType(entry, 'object', {
          moduleName: 'workbox-background-sync',
          className: 'QueueStore',
          funcName: 'pushEntry',
          paramName: 'entry'
        });
        assert_mjs.assert.isType(entry.requestData, 'object', {
          moduleName: 'workbox-background-sync',
          className: 'QueueStore',
          funcName: 'pushEntry',
          paramName: 'entry.requestData'
        });
      } // Don't specify an ID since one is automatically generated.


      delete entry.id;
      entry.queueName = this._queueName;
      await this._db.add(OBJECT_STORE_NAME, entry);
    }
    /**
     * Preppend an entry first in the queue.
     *
     * @param {Object} entry
     * @param {Object} entry.requestData
     * @param {number} [entry.timestamp]
     * @param {Object} [entry.metadata]
     * @private
     */


    async unshiftEntry(entry) {
      {
        assert_mjs.assert.isType(entry, 'object', {
          moduleName: 'workbox-background-sync',
          className: 'QueueStore',
          funcName: 'unshiftEntry',
          paramName: 'entry'
        });
        assert_mjs.assert.isType(entry.requestData, 'object', {
          moduleName: 'workbox-background-sync',
          className: 'QueueStore',
          funcName: 'unshiftEntry',
          paramName: 'entry.requestData'
        });
      }

      const [firstEntry] = await this._db.getAllMatching(OBJECT_STORE_NAME, {
        count: 1
      });

      if (firstEntry) {
        // Pick an ID one less than the lowest ID in the object store.
        entry.id = firstEntry.id - 1;
      } else {
        // Otherwise let the auto-incrementor assign the ID.
        delete entry.id;
      }

      entry.queueName = this._queueName;
      await this._db.add(OBJECT_STORE_NAME, entry);
    }
    /**
     * Removes and returns the last entry in the queue matching the `queueName`.
     *
     * @return {Promise<Object>}
     * @private
     */


    async popEntry() {
      return this._removeEntry({
        direction: 'prev'
      });
    }
    /**
     * Removes and returns the first entry in the queue matching the `queueName`.
     *
     * @return {Promise<Object>}
     * @private
     */


    async shiftEntry() {
      return this._removeEntry({
        direction: 'next'
      });
    }
    /**
     * Returns all entries in the store matching the `queueName`.
     *
     * @param {Object} options See workbox.backgroundSync.Queue~getAll}
     * @return {Promise<Array<Object>>}
     * @private
     */


    async getAll() {
      return await this._db.getAllMatching(OBJECT_STORE_NAME, {
        index: INDEXED_PROP,
        query: IDBKeyRange.only(this._queueName)
      });
    }
    /**
     * Deletes the entry for the given ID.
     *
     * WARNING: this method does not ensure the deleted enry belongs to this
     * queue (i.e. matches the `queueName`). But this limitation is acceptable
     * as this class is not publicly exposed. An additional check would make
     * this method slower than it needs to be.
     *
     * @private
     * @param {number} id
     */


    async deleteEntry(id) {
      await this._db.delete(OBJECT_STORE_NAME, id);
    }
    /**
     * Removes and returns the first or last entry in the queue (based on the
     * `direction` argument) matching the `queueName`.
     *
     * @return {Promise<Object>}
     * @private
     */


    async _removeEntry({
      direction
    }) {
      const [entry] = await this._db.getAllMatching(OBJECT_STORE_NAME, {
        direction,
        index: INDEXED_PROP,
        query: IDBKeyRange.only(this._queueName),
        count: 1
      });

      if (entry) {
        await this.deleteEntry(entry.id);
        return entry;
      }
    }
    /**
     * Upgrades the database given an `upgradeneeded` event.
     *
     * @param {Event} event
     * @private
     */


    _upgradeDb(event) {
      const db = event.target.result;

      if (event.oldVersion > 0 && event.oldVersion < DB_VERSION) {
        if (db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
          db.deleteObjectStore(OBJECT_STORE_NAME);
        }
      }

      const objStore = db.createObjectStore(OBJECT_STORE_NAME, {
        autoIncrement: true,
        keyPath: 'id'
      });
      objStore.createIndex(INDEXED_PROP, INDEXED_PROP, {
        unique: false
      });
    }

  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  const serializableProperties = ['method', 'referrer', 'referrerPolicy', 'mode', 'credentials', 'cache', 'redirect', 'integrity', 'keepalive'];
  /**
   * A class to make it easier to serialize and de-serialize requests so they
   * can be stored in IndexedDB.
   *
   * @private
   */

  class StorableRequest {
    /**
     * Converts a Request object to a plain object that can be structured
     * cloned or JSON-stringified.
     *
     * @param {Request} request
     * @return {Promise<StorableRequest>}
     *
     * @private
     */
    static async fromRequest(request) {
      const requestData = {
        url: request.url,
        headers: {}
      }; // Set the body if present.

      if (request.method !== 'GET') {
        // Use ArrayBuffer to support non-text request bodies.
        // NOTE: we can't use Blobs becuse Safari doesn't support storing
        // Blobs in IndexedDB in some cases:
        // https://github.com/dfahlander/Dexie.js/issues/618#issuecomment-398348457
        requestData.body = await request.clone().arrayBuffer();
      } // Convert the headers from an iterable to an object.


      for (const [key, value] of request.headers.entries()) {
        requestData.headers[key] = value;
      } // Add all other serializable request properties


      for (const prop of serializableProperties) {
        if (request[prop] !== undefined) {
          requestData[prop] = request[prop];
        }
      }

      return new StorableRequest(requestData);
    }
    /**
     * Accepts an object of request data that can be used to construct a
     * `Request` but can also be stored in IndexedDB.
     *
     * @param {Object} requestData An object of request data that includes the
     *     `url` plus any relevant properties of
     *     [requestInit]{@link https://fetch.spec.whatwg.org/#requestinit}.
     * @private
     */


    constructor(requestData) {
      {
        assert_mjs.assert.isType(requestData, 'object', {
          moduleName: 'workbox-background-sync',
          className: 'StorableRequest',
          funcName: 'constructor',
          paramName: 'requestData'
        });
        assert_mjs.assert.isType(requestData.url, 'string', {
          moduleName: 'workbox-background-sync',
          className: 'StorableRequest',
          funcName: 'constructor',
          paramName: 'requestData.url'
        });
      } // If the request's mode is `navigate`, convert it to `same-origin` since
      // navigation requests can't be constructed via script.


      if (requestData.mode === 'navigate') {
        requestData.mode = 'same-origin';
      }

      this._requestData = requestData;
    }
    /**
     * Returns a deep clone of the instances `_requestData` object.
     *
     * @return {Object}
     *
     * @private
     */


    toObject() {
      const requestData = Object.assign({}, this._requestData);
      requestData.headers = Object.assign({}, this._requestData.headers);

      if (requestData.body) {
        requestData.body = requestData.body.slice(0);
      }

      return requestData;
    }
    /**
     * Converts this instance to a Request.
     *
     * @return {Request}
     *
     * @private
     */


    toRequest() {
      return new Request(this._requestData.url, this._requestData);
    }
    /**
     * Creates and returns a deep clone of the instance.
     *
     * @return {StorableRequest}
     *
     * @private
     */


    clone() {
      return new StorableRequest(this.toObject());
    }

  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  const TAG_PREFIX = 'workbox-background-sync';
  const MAX_RETENTION_TIME = 60 * 24 * 7; // 7 days in minutes

  const queueNames = new Set();
  /**
   * A class to manage storing failed requests in IndexedDB and retrying them
   * later. All parts of the storing and replaying process are observable via
   * callbacks.
   *
   * @memberof workbox.backgroundSync
   */

  class Queue {
    /**
     * Creates an instance of Queue with the given options
     *
     * @param {string} name The unique name for this queue. This name must be
     *     unique as it's used to register sync events and store requests
     *     in IndexedDB specific to this instance. An error will be thrown if
     *     a duplicate name is detected.
     * @param {Object} [options]
     * @param {Function} [options.onSync] A function that gets invoked whenever
     *     the 'sync' event fires. The function is invoked with an object
     *     containing the `queue` property (referencing this instance), and you
     *     can use the callback to customize the replay behavior of the queue.
     *     When not set the `replayRequests()` method is called.
     *     Note: if the replay fails after a sync event, make sure you throw an
     *     error, so the browser knows to retry the sync event later.
     * @param {number} [options.maxRetentionTime=7 days] The amount of time (in
     *     minutes) a request may be retried. After this amount of time has
     *     passed, the request will be deleted from the queue.
     */
    constructor(name, {
      onSync,
      maxRetentionTime
    } = {}) {
      // Ensure the store name is not already being used
      if (queueNames.has(name)) {
        throw new WorkboxError_mjs.WorkboxError('duplicate-queue-name', {
          name
        });
      } else {
        queueNames.add(name);
      }

      this._name = name;
      this._onSync = onSync || this.replayRequests;
      this._maxRetentionTime = maxRetentionTime || MAX_RETENTION_TIME;
      this._queueStore = new QueueStore(this._name);

      this._addSyncListener();
    }
    /**
     * @return {string}
     */


    get name() {
      return this._name;
    }
    /**
     * Stores the passed request in IndexedDB (with its timestamp and any
     * metadata) at the end of the queue.
     *
     * @param {Object} entry
     * @param {Request} entry.request The request to store in the queue.
     * @param {Object} [entry.metadata] Any metadata you want associated with the
     *     stored request. When requests are replayed you'll have access to this
     *     metadata object in case you need to modify the request beforehand.
     * @param {number} [entry.timestamp] The timestamp (Epoch time in
     *     milliseconds) when the request was first added to the queue. This is
     *     used along with `maxRetentionTime` to remove outdated requests. In
     *     general you don't need to set this value, as it's automatically set
     *     for you (defaulting to `Date.now()`), but you can update it if you
     *     don't want particular requests to expire.
     */


    async pushRequest(entry) {
      {
        assert_mjs.assert.isType(entry, 'object', {
          moduleName: 'workbox-background-sync',
          className: 'Queue',
          funcName: 'pushRequest',
          paramName: 'entry'
        });
        assert_mjs.assert.isInstance(entry.request, Request, {
          moduleName: 'workbox-background-sync',
          className: 'Queue',
          funcName: 'pushRequest',
          paramName: 'entry.request'
        });
      }

      await this._addRequest(entry, 'push');
    }
    /**
     * Stores the passed request in IndexedDB (with its timestamp and any
     * metadata) at the beginning of the queue.
     *
     * @param {Object} entry
     * @param {Request} entry.request The request to store in the queue.
     * @param {Object} [entry.metadata] Any metadata you want associated with the
     *     stored request. When requests are replayed you'll have access to this
     *     metadata object in case you need to modify the request beforehand.
     * @param {number} [entry.timestamp] The timestamp (Epoch time in
     *     milliseconds) when the request was first added to the queue. This is
     *     used along with `maxRetentionTime` to remove outdated requests. In
     *     general you don't need to set this value, as it's automatically set
     *     for you (defaulting to `Date.now()`), but you can update it if you
     *     don't want particular requests to expire.
     */


    async unshiftRequest(entry) {
      {
        assert_mjs.assert.isType(entry, 'object', {
          moduleName: 'workbox-background-sync',
          className: 'Queue',
          funcName: 'unshiftRequest',
          paramName: 'entry'
        });
        assert_mjs.assert.isInstance(entry.request, Request, {
          moduleName: 'workbox-background-sync',
          className: 'Queue',
          funcName: 'unshiftRequest',
          paramName: 'entry.request'
        });
      }

      await this._addRequest(entry, 'unshift');
    }
    /**
     * Removes and returns the last request in the queue (along with its
     * timestamp and any metadata). The returned object takes the form:
     * `{request, timestamp, metadata}`.
     *
     * @return {Promise<Object>}
     */


    async popRequest() {
      return this._removeRequest('pop');
    }
    /**
     * Removes and returns the first request in the queue (along with its
     * timestamp and any metadata). The returned object takes the form:
     * `{request, timestamp, metadata}`.
     *
     * @return {Promise<Object>}
     */


    async shiftRequest() {
      return this._removeRequest('shift');
    }
    /**
     * Returns all the entries that have not expired (per `maxRetentionTime`).
     * Any expired entries are removed from the queue.
     *
     * @return {Promise<Array<Object>>}
     */


    async getAll() {
      const allEntries = await this._queueStore.getAll();
      const now = Date.now();
      const unexpiredEntries = [];

      for (const entry of allEntries) {
        // Ignore requests older than maxRetentionTime. Call this function
        // recursively until an unexpired request is found.
        const maxRetentionTimeInMs = this._maxRetentionTime * 60 * 1000;

        if (now - entry.timestamp > maxRetentionTimeInMs) {
          await this._queueStore.deleteEntry(entry.id);
        } else {
          unexpiredEntries.push(convertEntry(entry));
        }
      }

      return unexpiredEntries;
    }
    /**
     * Adds the entry to the QueueStore and registers for a sync event.
     *
     * @param {Object} entry
     * @param {Request} entry.request
     * @param {Object} [entry.metadata]
     * @param {number} [entry.timestamp=Date.now()]
     * @param {string} operation ('push' or 'unshift')
     * @private
     */


    async _addRequest({
      request,
      metadata,
      timestamp = Date.now()
    }, operation) {
      const storableRequest = await StorableRequest.fromRequest(request.clone());
      const entry = {
        requestData: storableRequest.toObject(),
        timestamp
      }; // Only include metadata if it's present.

      if (metadata) {
        entry.metadata = metadata;
      }

      await this._queueStore[`${operation}Entry`](entry);

      {
        logger_mjs.logger.log(`Request for '${getFriendlyURL_mjs.getFriendlyURL(request.url)}' has ` + `been added to background sync queue '${this._name}'.`);
      } // Don't register for a sync if we're in the middle of a sync. Instead,
      // we wait until the sync is complete and call register if
      // `this._requestsAddedDuringSync` is true.


      if (this._syncInProgress) {
        this._requestsAddedDuringSync = true;
      } else {
        await this.registerSync();
      }
    }
    /**
     * Removes and returns the first or last (depending on `operation`) entry
     * from the QueueStore that's not older than the `maxRetentionTime`.
     *
     * @param {string} operation ('pop' or 'shift')
     * @return {Object|undefined}
     * @private
     */


    async _removeRequest(operation) {
      const now = Date.now();
      const entry = await this._queueStore[`${operation}Entry`]();

      if (entry) {
        // Ignore requests older than maxRetentionTime. Call this function
        // recursively until an unexpired request is found.
        const maxRetentionTimeInMs = this._maxRetentionTime * 60 * 1000;

        if (now - entry.timestamp > maxRetentionTimeInMs) {
          return this._removeRequest(operation);
        }

        return convertEntry(entry);
      }
    }
    /**
     * Loops through each request in the queue and attempts to re-fetch it.
     * If any request fails to re-fetch, it's put back in the same position in
     * the queue (which registers a retry for the next sync event).
     */


    async replayRequests() {
      let entry;

      while (entry = await this.shiftRequest()) {
        try {
          await fetch(entry.request.clone());

          {
            logger_mjs.logger.log(`Request for '${getFriendlyURL_mjs.getFriendlyURL(entry.request.url)}'` + `has been replayed in queue '${this._name}'`);
          }
        } catch (error) {
          await this.unshiftRequest(entry);

          {
            logger_mjs.logger.log(`Request for '${getFriendlyURL_mjs.getFriendlyURL(entry.request.url)}'` + `failed to replay, putting it back in queue '${this._name}'`);
          }

          throw new WorkboxError_mjs.WorkboxError('queue-replay-failed', {
            name: this._name
          });
        }
      }

      {
        logger_mjs.logger.log(`All requests in queue '${this.name}' have successfully ` + `replayed; the queue is now empty!`);
      }
    }
    /**
     * Registers a sync event with a tag unique to this instance.
     */


    async registerSync() {
      if ('sync' in registration) {
        try {
          await registration.sync.register(`${TAG_PREFIX}:${this._name}`);
        } catch (err) {
          // This means the registration failed for some reason, possibly due to
          // the user disabling it.
          {
            logger_mjs.logger.warn(`Unable to register sync event for '${this._name}'.`, err);
          }
        }
      }
    }
    /**
     * In sync-supporting browsers, this adds a listener for the sync event.
     * In non-sync-supporting browsers, this will retry the queue on service
     * worker startup.
     *
     * @private
     */


    _addSyncListener() {
      if ('sync' in registration) {
        self.addEventListener('sync', event => {
          if (event.tag === `${TAG_PREFIX}:${this._name}`) {
            {
              logger_mjs.logger.log(`Background sync for tag '${event.tag}'` + `has been received`);
            }

            const syncComplete = async () => {
              this._syncInProgress = true;
              let syncError;

              try {
                await this._onSync({
                  queue: this
                });
              } catch (error) {
                syncError = error; // Rethrow the error. Note: the logic in the finally clause
                // will run before this gets rethrown.

                throw syncError;
              } finally {
                // New items may have been added to the queue during the sync,
                // so we need to register for a new sync if that's happened...
                // Unless there was an error during the sync, in which
                // case the browser will automatically retry later, as long
                // as `event.lastChance` is not true.
                if (this._requestsAddedDuringSync && !(syncError && !event.lastChance)) {
                  await this.registerSync();
                }

                this._syncInProgress = false;
                this._requestsAddedDuringSync = false;
              }
            };

            event.waitUntil(syncComplete());
          }
        });
      } else {
        {
          logger_mjs.logger.log(`Background sync replaying without background sync event`);
        } // If the browser doesn't support background sync, retry
        // every time the service worker starts up as a fallback.


        this._onSync({
          queue: this
        });
      }
    }
    /**
     * Returns the set of queue names. This is primarily used to reset the list
     * of queue names in tests.
     *
     * @return {Set}
     *
     * @private
     */


    static get _queueNames() {
      return queueNames;
    }

  }
  /**
   * Converts a QueueStore entry into the format exposed by Queue. This entails
   * converting the request data into a real request and omitting the `id` and
   * `queueName` properties.
   *
   * @param {Object} queueStoreEntry
   * @return {Object}
   * @private
   */


  const convertEntry = queueStoreEntry => {
    const queueEntry = {
      request: new StorableRequest(queueStoreEntry.requestData).toRequest(),
      timestamp: queueStoreEntry.timestamp
    };

    if (queueStoreEntry.metadata) {
      queueEntry.metadata = queueStoreEntry.metadata;
    }

    return queueEntry;
  };

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * A class implementing the `fetchDidFail` lifecycle callback. This makes it
   * easier to add failed requests to a background sync Queue.
   *
   * @memberof workbox.backgroundSync
   */

  class Plugin {
    /**
     * @param {...*} queueArgs Args to forward to the composed Queue instance.
     *    See the [Queue]{@link workbox.backgroundSync.Queue} documentation for
     *    parameter details.
     */
    constructor(...queueArgs) {
      this._queue = new Queue(...queueArgs);
      this.fetchDidFail = this.fetchDidFail.bind(this);
    }
    /**
     * @param {Object} options
     * @param {Request} options.request
     * @private
     */


    async fetchDidFail({
      request
    }) {
      await this._queue.pushRequest({
        request
      });
    }

  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */

  exports.Queue = Queue;
  exports.Plugin = Plugin;

  return exports;

}({}, workbox.core._private, workbox.core._private, workbox.core._private, workbox.core._private, workbox.core._private));
//# sourceMappingURL=workbox-background-sync.dev.js.map
