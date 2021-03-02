this.workbox = this.workbox || {};
this.workbox.broadcastUpdate = (function (exports, assert_mjs, getFriendlyURL_mjs, logger_mjs, Deferred_mjs, WorkboxError_mjs) {
  'use strict';

  try {
    self['workbox:broadcast-update:4.3.1'] && _();
  } catch (e) {} // eslint-disable-line

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * Given two `Response's`, compares several header values to see if they are
   * the same or not.
   *
   * @param {Response} firstResponse
   * @param {Response} secondResponse
   * @param {Array<string>} headersToCheck
   * @return {boolean}
   *
   * @memberof workbox.broadcastUpdate
   * @private
   */

  const responsesAreSame = (firstResponse, secondResponse, headersToCheck) => {
    {
      if (!(firstResponse instanceof Response && secondResponse instanceof Response)) {
        throw new WorkboxError_mjs.WorkboxError('invalid-responses-are-same-args');
      }
    }

    const atLeastOneHeaderAvailable = headersToCheck.some(header => {
      return firstResponse.headers.has(header) && secondResponse.headers.has(header);
    });

    if (!atLeastOneHeaderAvailable) {
      {
        logger_mjs.logger.warn(`Unable to determine where the response has been updated ` + `because none of the headers that would be checked are present.`);
        logger_mjs.logger.debug(`Attempting to compare the following: `, firstResponse, secondResponse, headersToCheck);
      } // Just return true, indicating the that responses are the same, since we
      // can't determine otherwise.


      return true;
    }

    return headersToCheck.every(header => {
      const headerStateComparison = firstResponse.headers.has(header) === secondResponse.headers.has(header);
      const headerValueComparison = firstResponse.headers.get(header) === secondResponse.headers.get(header);
      return headerStateComparison && headerValueComparison;
    });
  };

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  const CACHE_UPDATED_MESSAGE_TYPE = 'CACHE_UPDATED';
  const CACHE_UPDATED_MESSAGE_META = 'workbox-broadcast-update';
  const DEFAULT_BROADCAST_CHANNEL_NAME = 'workbox';
  const DEFAULT_DEFER_NOTIFICATION_TIMEOUT = 10000;
  const DEFAULT_HEADERS_TO_CHECK = ['content-length', 'etag', 'last-modified'];

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * You would not normally call this method directly; it's called automatically
   * by an instance of the {@link BroadcastCacheUpdate} class. It's exposed here
   * for the benefit of developers who would rather not use the full
   * `BroadcastCacheUpdate` implementation.
   *
   * Calling this will dispatch a message on the provided
   * {@link https://developers.google.com/web/updates/2016/09/broadcastchannel|Broadcast Channel}
   * to notify interested subscribers about a change to a cached resource.
   *
   * The message that's posted has a formation inspired by the
   * [Flux standard action](https://github.com/acdlite/flux-standard-action#introduction)
   * format like so:
   *
   * ```
   * {
   *   type: 'CACHE_UPDATED',
   *   meta: 'workbox-broadcast-update',
   *   payload: {
   *     cacheName: 'the-cache-name',
   *     updatedURL: 'https://example.com/'
   *   }
   * }
   * ```
   *
   * (Usage of [Flux](https://facebook.github.io/flux/) itself is not at
   * all required.)
   *
   * @param {Object} options
   * @param {string} options.cacheName The name of the cache in which the updated
   *     `Response` was stored.
   * @param {string} options.url The URL associated with the updated `Response`.
   * @param {BroadcastChannel} [options.channel] The `BroadcastChannel` to use.
   *     If no channel is set or the browser doesn't support the BroadcastChannel
   *     api, then an attempt will be made to `postMessage` each window client.
   *
   * @memberof workbox.broadcastUpdate
   */

  const broadcastUpdate = async ({
    channel,
    cacheName,
    url
  }) => {
    {
      assert_mjs.assert.isType(cacheName, 'string', {
        moduleName: 'workbox-broadcast-update',
        className: '~',
        funcName: 'broadcastUpdate',
        paramName: 'cacheName'
      });
      assert_mjs.assert.isType(url, 'string', {
        moduleName: 'workbox-broadcast-update',
        className: '~',
        funcName: 'broadcastUpdate',
        paramName: 'url'
      });
    }

    const data = {
      type: CACHE_UPDATED_MESSAGE_TYPE,
      meta: CACHE_UPDATED_MESSAGE_META,
      payload: {
        cacheName: cacheName,
        updatedURL: url
      }
    };

    if (channel) {
      channel.postMessage(data);
    } else {
      const windows = await clients.matchAll({
        type: 'window'
      });

      for (const win of windows) {
        win.postMessage(data);
      }
    }
  };

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * Uses the [Broadcast Channel API]{@link https://developers.google.com/web/updates/2016/09/broadcastchannel}
   * to notify interested parties when a cached response has been updated.
   * In browsers that do not support the Broadcast Channel API, the instance
   * falls back to sending the update via `postMessage()` to all window clients.
   *
   * For efficiency's sake, the underlying response bodies are not compared;
   * only specific response headers are checked.
   *
   * @memberof workbox.broadcastUpdate
   */

  class BroadcastCacheUpdate {
    /**
     * Construct a BroadcastCacheUpdate instance with a specific `channelName` to
     * broadcast messages on
     *
     * @param {Object} options
     * @param {Array<string>}
     *     [options.headersToCheck=['content-length', 'etag', 'last-modified']]
     *     A list of headers that will be used to determine whether the responses
     *     differ.
     * @param {string} [options.channelName='workbox'] The name that will be used
     *.    when creating the `BroadcastChannel`, which defaults to 'workbox' (the
     *     channel name used by the `workbox-window` package).
     * @param {string} [options.deferNoticationTimeout=10000] The amount of time
     *     to wait for a ready message from the window on navigation requests
     *     before sending the update.
     */
    constructor({
      headersToCheck,
      channelName,
      deferNoticationTimeout
    } = {}) {
      this._headersToCheck = headersToCheck || DEFAULT_HEADERS_TO_CHECK;
      this._channelName = channelName || DEFAULT_BROADCAST_CHANNEL_NAME;
      this._deferNoticationTimeout = deferNoticationTimeout || DEFAULT_DEFER_NOTIFICATION_TIMEOUT;

      {
        assert_mjs.assert.isType(this._channelName, 'string', {
          moduleName: 'workbox-broadcast-update',
          className: 'BroadcastCacheUpdate',
          funcName: 'constructor',
          paramName: 'channelName'
        });
        assert_mjs.assert.isArray(this._headersToCheck, {
          moduleName: 'workbox-broadcast-update',
          className: 'BroadcastCacheUpdate',
          funcName: 'constructor',
          paramName: 'headersToCheck'
        });
      }

      this._initWindowReadyDeferreds();
    }
    /**
     * Compare two [Responses](https://developer.mozilla.org/en-US/docs/Web/API/Response)
     * and send a message via the
     * {@link https://developers.google.com/web/updates/2016/09/broadcastchannel|Broadcast Channel API}
     * if they differ.
     *
     * Neither of the Responses can be {@link http://stackoverflow.com/questions/39109789|opaque}.
     *
     * @param {Object} options
     * @param {Response} options.oldResponse Cached response to compare.
     * @param {Response} options.newResponse Possibly updated response to compare.
     * @param {string} options.url The URL of the request.
     * @param {string} options.cacheName Name of the cache the responses belong
     *     to. This is included in the broadcast message.
     * @param {Event} [options.event] event An optional event that triggered
     *     this possible cache update.
     * @return {Promise} Resolves once the update is sent.
     */


    notifyIfUpdated({
      oldResponse,
      newResponse,
      url,
      cacheName,
      event
    }) {
      if (!responsesAreSame(oldResponse, newResponse, this._headersToCheck)) {
        {
          logger_mjs.logger.log(`Newer response found (and cached) for:`, url);
        }

        const sendUpdate = async () => {
          // In the case of a navigation request, the requesting page will likely
          // not have loaded its JavaScript in time to recevied the update
          // notification, so we defer it until ready (or we timeout waiting).
          if (event && event.request && event.request.mode === 'navigate') {
            {
              logger_mjs.logger.debug(`Original request was a navigation request, ` + `waiting for a ready message from the window`, event.request);
            }

            await this._windowReadyOrTimeout(event);
          }

          await this._broadcastUpdate({
            channel: this._getChannel(),
            cacheName,
            url
          });
        }; // Send the update and ensure the SW stays alive until it's sent.


        const done = sendUpdate();

        if (event) {
          try {
            event.waitUntil(done);
          } catch (error) {
            {
              logger_mjs.logger.warn(`Unable to ensure service worker stays alive ` + `when broadcasting cache update for ` + `${getFriendlyURL_mjs.getFriendlyURL(event.request.url)}'.`);
            }
          }
        }

        return done;
      }
    }
    /**
     * NOTE: this is exposed on the instance primarily so it can be spied on
     * in tests.
     *
     * @param {Object} opts
     * @private
     */


    async _broadcastUpdate(opts) {
      await broadcastUpdate(opts);
    }
    /**
     * @return {BroadcastChannel|undefined} The BroadcastChannel instance used for
     * broadcasting updates, or undefined if the browser doesn't support the
     * Broadcast Channel API.
     *
     * @private
     */


    _getChannel() {
      if ('BroadcastChannel' in self && !this._channel) {
        this._channel = new BroadcastChannel(this._channelName);
      }

      return this._channel;
    }
    /**
     * Waits for a message from the window indicating that it's capable of
     * receiving broadcasts. By default, this will only wait for the amount of
     * time specified via the `deferNoticationTimeout` option.
     *
     * @param {Event} event The navigation fetch event.
     * @return {Promise}
     * @private
     */


    _windowReadyOrTimeout(event) {
      if (!this._navigationEventsDeferreds.has(event)) {
        const deferred = new Deferred_mjs.Deferred(); // Set the deferred on the `_navigationEventsDeferreds` map so it will
        // be resolved when the next ready message event comes.

        this._navigationEventsDeferreds.set(event, deferred); // But don't wait too long for the message since it may never come.


        const timeout = setTimeout(() => {
          {
            logger_mjs.logger.debug(`Timed out after ${this._deferNoticationTimeout}` + `ms waiting for message from window`);
          }

          deferred.resolve();
        }, this._deferNoticationTimeout); // Ensure the timeout is cleared if the deferred promise is resolved.

        deferred.promise.then(() => clearTimeout(timeout));
      }

      return this._navigationEventsDeferreds.get(event).promise;
    }
    /**
     * Creates a mapping between navigation fetch events and deferreds, and adds
     * a listener for message events from the window. When message events arrive,
     * all deferreds in the mapping are resolved.
     *
     * Note: it would be easier if we could only resolve the deferred of
     * navigation fetch event whose client ID matched the source ID of the
     * message event, but currently client IDs are not exposed on navigation
     * fetch events: https://www.chromestatus.com/feature/4846038800138240
     *
     * @private
     */


    _initWindowReadyDeferreds() {
      // A mapping between navigation events and their deferreds.
      this._navigationEventsDeferreds = new Map(); // The message listener needs to be added in the initial run of the
      // service worker, but since we don't actually need to be listening for
      // messages until the cache updates, we only invoke the callback if set.

      self.addEventListener('message', event => {
        if (event.data.type === 'WINDOW_READY' && event.data.meta === 'workbox-window' && this._navigationEventsDeferreds.size > 0) {
          {
            logger_mjs.logger.debug(`Received WINDOW_READY event: `, event);
          } // Resolve any pending deferreds.


          for (const deferred of this._navigationEventsDeferreds.values()) {
            deferred.resolve();
          }

          this._navigationEventsDeferreds.clear();
        }
      });
    }

  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * This plugin will automatically broadcast a message whenever a cached response
   * is updated.
   *
   * @memberof workbox.broadcastUpdate
   */

  class Plugin {
    /**
     * Construct a BroadcastCacheUpdate instance with the passed options and
     * calls its `notifyIfUpdated()` method whenever the plugin's
     * `cacheDidUpdate` callback is invoked.
     *
     * @param {Object} options
     * @param {Array<string>}
     *     [options.headersToCheck=['content-length', 'etag', 'last-modified']]
     *     A list of headers that will be used to determine whether the responses
     *     differ.
     * @param {string} [options.channelName='workbox'] The name that will be used
     *.    when creating the `BroadcastChannel`, which defaults to 'workbox' (the
     *     channel name used by the `workbox-window` package).
     * @param {string} [options.deferNoticationTimeout=10000] The amount of time
     *     to wait for a ready message from the window on navigation requests
     *     before sending the update.
     */
    constructor(options) {
      this._broadcastUpdate = new BroadcastCacheUpdate(options);
    }
    /**
     * A "lifecycle" callback that will be triggered automatically by the
     * `workbox-sw` and `workbox-runtime-caching` handlers when an entry is
     * added to a cache.
     *
     * @private
     * @param {Object} options The input object to this function.
     * @param {string} options.cacheName Name of the cache being updated.
     * @param {Response} [options.oldResponse] The previous cached value, if any.
     * @param {Response} options.newResponse The new value in the cache.
     * @param {Request} options.request The request that triggered the udpate.
     * @param {Request} [options.event] The event that triggered the update.
     */


    cacheDidUpdate({
      cacheName,
      oldResponse,
      newResponse,
      request,
      event
    }) {
      {
        assert_mjs.assert.isType(cacheName, 'string', {
          moduleName: 'workbox-broadcast-update',
          className: 'Plugin',
          funcName: 'cacheDidUpdate',
          paramName: 'cacheName'
        });
        assert_mjs.assert.isInstance(newResponse, Response, {
          moduleName: 'workbox-broadcast-update',
          className: 'Plugin',
          funcName: 'cacheDidUpdate',
          paramName: 'newResponse'
        });
        assert_mjs.assert.isInstance(request, Request, {
          moduleName: 'workbox-broadcast-update',
          className: 'Plugin',
          funcName: 'cacheDidUpdate',
          paramName: 'request'
        });
      }

      if (!oldResponse) {
        // Without a two responses there is nothing to compare.
        return;
      }

      this._broadcastUpdate.notifyIfUpdated({
        cacheName,
        oldResponse,
        newResponse,
        event,
        url: request.url
      });
    }

  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */

  exports.BroadcastCacheUpdate = BroadcastCacheUpdate;
  exports.Plugin = Plugin;
  exports.broadcastUpdate = broadcastUpdate;
  exports.responsesAreSame = responsesAreSame;

  return exports;

}({}, workbox.core._private, workbox.core._private, workbox.core._private, workbox.core._private, workbox.core._private));
//# sourceMappingURL=workbox-broadcast-update.dev.js.map
