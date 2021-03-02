this.workbox = this.workbox || {};
this.workbox.strategies = (function (exports, logger_mjs, assert_mjs, cacheNames_mjs, cacheWrapper_mjs, fetchWrapper_mjs, getFriendlyURL_mjs, WorkboxError_mjs) {
  'use strict';

  try {
    self['workbox:strategies:4.3.1'] && _();
  } catch (e) {} // eslint-disable-line

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */

  const getFriendlyURL = url => {
    const urlObj = new URL(url, location);

    if (urlObj.origin === location.origin) {
      return urlObj.pathname;
    }

    return urlObj.href;
  };

  const messages = {
    strategyStart: (strategyName, request) => `Using ${strategyName} to ` + `respond to '${getFriendlyURL(request.url)}'`,
    printFinalResponse: response => {
      if (response) {
        logger_mjs.logger.groupCollapsed(`View the final response here.`);
        logger_mjs.logger.log(response);
        logger_mjs.logger.groupEnd();
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
   * An implementation of a [cache-first]{@link https://developers.google.com/web/fundamentals/instant-and-offline/offline-cookbook/#cache-falling-back-to-network}
   * request strategy.
   *
   * A cache first strategy is useful for assets that have been revisioned,
   * such as URLs like `/styles/example.a8f5f1.css`, since they
   * can be cached for long periods of time.
   *
   * If the network request fails, and there is no cache match, this will throw
   * a `WorkboxError` exception.
   *
   * @memberof workbox.strategies
   */

  class CacheFirst {
    /**
     * @param {Object} options
     * @param {string} options.cacheName Cache name to store and retrieve
     * requests. Defaults to cache names provided by
     * [workbox-core]{@link workbox.core.cacheNames}.
     * @param {Array<Object>} options.plugins [Plugins]{@link https://developers.google.com/web/tools/workbox/guides/using-plugins}
     * to use in conjunction with this caching strategy.
     * @param {Object} options.fetchOptions Values passed along to the
     * [`init`](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters)
     * of all fetch() requests made by this strategy.
     * @param {Object} options.matchOptions [`CacheQueryOptions`](https://w3c.github.io/ServiceWorker/#dictdef-cachequeryoptions)
     */
    constructor(options = {}) {
      this._cacheName = cacheNames_mjs.cacheNames.getRuntimeName(options.cacheName);
      this._plugins = options.plugins || [];
      this._fetchOptions = options.fetchOptions || null;
      this._matchOptions = options.matchOptions || null;
    }
    /**
     * This method will perform a request strategy and follows an API that
     * will work with the
     * [Workbox Router]{@link workbox.routing.Router}.
     *
     * @param {Object} options
     * @param {Request} options.request The request to run this strategy for.
     * @param {Event} [options.event] The event that triggered the request.
     * @return {Promise<Response>}
     */


    async handle({
      event,
      request
    }) {
      return this.makeRequest({
        event,
        request: request || event.request
      });
    }
    /**
     * This method can be used to perform a make a standalone request outside the
     * context of the [Workbox Router]{@link workbox.routing.Router}.
     *
     * See "[Advanced Recipes](https://developers.google.com/web/tools/workbox/guides/advanced-recipes#make-requests)"
     * for more usage information.
     *
     * @param {Object} options
     * @param {Request|string} options.request Either a
     *     [`Request`]{@link https://developer.mozilla.org/en-US/docs/Web/API/Request}
     *     object, or a string URL, corresponding to the request to be made.
     * @param {FetchEvent} [options.event] If provided, `event.waitUntil()` will
           be called automatically to extend the service worker's lifetime.
     * @return {Promise<Response>}
     */


    async makeRequest({
      event,
      request
    }) {
      const logs = [];

      if (typeof request === 'string') {
        request = new Request(request);
      }

      {
        assert_mjs.assert.isInstance(request, Request, {
          moduleName: 'workbox-strategies',
          className: 'CacheFirst',
          funcName: 'makeRequest',
          paramName: 'request'
        });
      }

      let response = await cacheWrapper_mjs.cacheWrapper.match({
        cacheName: this._cacheName,
        request,
        event,
        matchOptions: this._matchOptions,
        plugins: this._plugins
      });
      let error;

      if (!response) {
        {
          logs.push(`No response found in the '${this._cacheName}' cache. ` + `Will respond with a network request.`);
        }

        try {
          response = await this._getFromNetwork(request, event);
        } catch (err) {
          error = err;
        }

        {
          if (response) {
            logs.push(`Got response from network.`);
          } else {
            logs.push(`Unable to get a response from the network.`);
          }
        }
      } else {
        {
          logs.push(`Found a cached response in the '${this._cacheName}' cache.`);
        }
      }

      {
        logger_mjs.logger.groupCollapsed(messages.strategyStart('CacheFirst', request));

        for (let log of logs) {
          logger_mjs.logger.log(log);
        }

        messages.printFinalResponse(response);
        logger_mjs.logger.groupEnd();
      }

      if (!response) {
        throw new WorkboxError_mjs.WorkboxError('no-response', {
          url: request.url,
          error
        });
      }

      return response;
    }
    /**
     * Handles the network and cache part of CacheFirst.
     *
     * @param {Request} request
     * @param {FetchEvent} [event]
     * @return {Promise<Response>}
     *
     * @private
     */


    async _getFromNetwork(request, event) {
      const response = await fetchWrapper_mjs.fetchWrapper.fetch({
        request,
        event,
        fetchOptions: this._fetchOptions,
        plugins: this._plugins
      }); // Keep the service worker while we put the request to the cache

      const responseClone = response.clone();
      const cachePutPromise = cacheWrapper_mjs.cacheWrapper.put({
        cacheName: this._cacheName,
        request,
        response: responseClone,
        event,
        plugins: this._plugins
      });

      if (event) {
        try {
          event.waitUntil(cachePutPromise);
        } catch (error) {
          {
            logger_mjs.logger.warn(`Unable to ensure service worker stays alive when ` + `updating cache for '${getFriendlyURL_mjs.getFriendlyURL(request.url)}'.`);
          }
        }
      }

      return response;
    }

  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * An implementation of a
   * [cache-only]{@link https://developers.google.com/web/fundamentals/instant-and-offline/offline-cookbook/#cache-only}
   * request strategy.
   *
   * This class is useful if you want to take advantage of any
   * [Workbox plugins]{@link https://developers.google.com/web/tools/workbox/guides/using-plugins}.
   *
   * If there is no cache match, this will throw a `WorkboxError` exception.
   *
   * @memberof workbox.strategies
   */

  class CacheOnly {
    /**
     * @param {Object} options
     * @param {string} options.cacheName Cache name to store and retrieve
     * requests. Defaults to cache names provided by
     * [workbox-core]{@link workbox.core.cacheNames}.
     * @param {Array<Object>} options.plugins [Plugins]{@link https://developers.google.com/web/tools/workbox/guides/using-plugins}
     * to use in conjunction with this caching strategy.
     * @param {Object} options.matchOptions [`CacheQueryOptions`](https://w3c.github.io/ServiceWorker/#dictdef-cachequeryoptions)
     */
    constructor(options = {}) {
      this._cacheName = cacheNames_mjs.cacheNames.getRuntimeName(options.cacheName);
      this._plugins = options.plugins || [];
      this._matchOptions = options.matchOptions || null;
    }
    /**
     * This method will perform a request strategy and follows an API that
     * will work with the
     * [Workbox Router]{@link workbox.routing.Router}.
     *
     * @param {Object} options
     * @param {Request} options.request The request to run this strategy for.
     * @param {Event} [options.event] The event that triggered the request.
     * @return {Promise<Response>}
     */


    async handle({
      event,
      request
    }) {
      return this.makeRequest({
        event,
        request: request || event.request
      });
    }
    /**
     * This method can be used to perform a make a standalone request outside the
     * context of the [Workbox Router]{@link workbox.routing.Router}.
     *
     * See "[Advanced Recipes](https://developers.google.com/web/tools/workbox/guides/advanced-recipes#make-requests)"
     * for more usage information.
     *
     * @param {Object} options
     * @param {Request|string} options.request Either a
     *     [`Request`]{@link https://developer.mozilla.org/en-US/docs/Web/API/Request}
     *     object, or a string URL, corresponding to the request to be made.
     * @param {FetchEvent} [options.event] If provided, `event.waitUntil()` will
     *     be called automatically to extend the service worker's lifetime.
     * @return {Promise<Response>}
     */


    async makeRequest({
      event,
      request
    }) {
      if (typeof request === 'string') {
        request = new Request(request);
      }

      {
        assert_mjs.assert.isInstance(request, Request, {
          moduleName: 'workbox-strategies',
          className: 'CacheOnly',
          funcName: 'makeRequest',
          paramName: 'request'
        });
      }

      const response = await cacheWrapper_mjs.cacheWrapper.match({
        cacheName: this._cacheName,
        request,
        event,
        matchOptions: this._matchOptions,
        plugins: this._plugins
      });

      {
        logger_mjs.logger.groupCollapsed(messages.strategyStart('CacheOnly', request));

        if (response) {
          logger_mjs.logger.log(`Found a cached response in the '${this._cacheName}'` + ` cache.`);
          messages.printFinalResponse(response);
        } else {
          logger_mjs.logger.log(`No response found in the '${this._cacheName}' cache.`);
        }

        logger_mjs.logger.groupEnd();
      }

      if (!response) {
        throw new WorkboxError_mjs.WorkboxError('no-response', {
          url: request.url
        });
      }

      return response;
    }

  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  const cacheOkAndOpaquePlugin = {
    /**
     * Returns a valid response (to allow caching) if the status is 200 (OK) or
     * 0 (opaque).
     *
     * @param {Object} options
     * @param {Response} options.response
     * @return {Response|null}
     *
     * @private
     */
    cacheWillUpdate: ({
      response
    }) => {
      if (response.status === 200 || response.status === 0) {
        return response;
      }

      return null;
    }
  };

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * An implementation of a
   * [network first]{@link https://developers.google.com/web/fundamentals/instant-and-offline/offline-cookbook/#network-falling-back-to-cache}
   * request strategy.
   *
   * By default, this strategy will cache responses with a 200 status code as
   * well as [opaque responses]{@link https://developers.google.com/web/tools/workbox/guides/handle-third-party-requests}.
   * Opaque responses are are cross-origin requests where the response doesn't
   * support [CORS]{@link https://enable-cors.org/}.
   *
   * If the network request fails, and there is no cache match, this will throw
   * a `WorkboxError` exception.
   *
   * @memberof workbox.strategies
   */

  class NetworkFirst {
    /**
     * @param {Object} options
     * @param {string} options.cacheName Cache name to store and retrieve
     * requests. Defaults to cache names provided by
     * [workbox-core]{@link workbox.core.cacheNames}.
     * @param {Array<Object>} options.plugins [Plugins]{@link https://developers.google.com/web/tools/workbox/guides/using-plugins}
     * to use in conjunction with this caching strategy.
     * @param {Object} options.fetchOptions Values passed along to the
     * [`init`](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters)
     * of all fetch() requests made by this strategy.
     * @param {Object} options.matchOptions [`CacheQueryOptions`](https://w3c.github.io/ServiceWorker/#dictdef-cachequeryoptions)
     * @param {number} options.networkTimeoutSeconds If set, any network requests
     * that fail to respond within the timeout will fallback to the cache.
     *
     * This option can be used to combat
     * "[lie-fi]{@link https://developers.google.com/web/fundamentals/performance/poor-connectivity/#lie-fi}"
     * scenarios.
     */
    constructor(options = {}) {
      this._cacheName = cacheNames_mjs.cacheNames.getRuntimeName(options.cacheName);

      if (options.plugins) {
        let isUsingCacheWillUpdate = options.plugins.some(plugin => !!plugin.cacheWillUpdate);
        this._plugins = isUsingCacheWillUpdate ? options.plugins : [cacheOkAndOpaquePlugin, ...options.plugins];
      } else {
        // No plugins passed in, use the default plugin.
        this._plugins = [cacheOkAndOpaquePlugin];
      }

      this._networkTimeoutSeconds = options.networkTimeoutSeconds;

      {
        if (this._networkTimeoutSeconds) {
          assert_mjs.assert.isType(this._networkTimeoutSeconds, 'number', {
            moduleName: 'workbox-strategies',
            className: 'NetworkFirst',
            funcName: 'constructor',
            paramName: 'networkTimeoutSeconds'
          });
        }
      }

      this._fetchOptions = options.fetchOptions || null;
      this._matchOptions = options.matchOptions || null;
    }
    /**
     * This method will perform a request strategy and follows an API that
     * will work with the
     * [Workbox Router]{@link workbox.routing.Router}.
     *
     * @param {Object} options
     * @param {Request} options.request The request to run this strategy for.
     * @param {Event} [options.event] The event that triggered the request.
     * @return {Promise<Response>}
     */


    async handle({
      event,
      request
    }) {
      return this.makeRequest({
        event,
        request: request || event.request
      });
    }
    /**
     * This method can be used to perform a make a standalone request outside the
     * context of the [Workbox Router]{@link workbox.routing.Router}.
     *
     * See "[Advanced Recipes](https://developers.google.com/web/tools/workbox/guides/advanced-recipes#make-requests)"
     * for more usage information.
     *
     * @param {Object} options
     * @param {Request|string} options.request Either a
     *     [`Request`]{@link https://developer.mozilla.org/en-US/docs/Web/API/Request}
     *     object, or a string URL, corresponding to the request to be made.
     * @param {FetchEvent} [options.event] If provided, `event.waitUntil()` will
     *     be called automatically to extend the service worker's lifetime.
     * @return {Promise<Response>}
     */


    async makeRequest({
      event,
      request
    }) {
      const logs = [];

      if (typeof request === 'string') {
        request = new Request(request);
      }

      {
        assert_mjs.assert.isInstance(request, Request, {
          moduleName: 'workbox-strategies',
          className: 'NetworkFirst',
          funcName: 'handle',
          paramName: 'makeRequest'
        });
      }

      const promises = [];
      let timeoutId;

      if (this._networkTimeoutSeconds) {
        const {
          id,
          promise
        } = this._getTimeoutPromise({
          request,
          event,
          logs
        });

        timeoutId = id;
        promises.push(promise);
      }

      const networkPromise = this._getNetworkPromise({
        timeoutId,
        request,
        event,
        logs
      });

      promises.push(networkPromise); // Promise.race() will resolve as soon as the first promise resolves.

      let response = await Promise.race(promises); // If Promise.race() resolved with null, it might be due to a network
      // timeout + a cache miss. If that were to happen, we'd rather wait until
      // the networkPromise resolves instead of returning null.
      // Note that it's fine to await an already-resolved promise, so we don't
      // have to check to see if it's still "in flight".

      if (!response) {
        response = await networkPromise;
      }

      {
        logger_mjs.logger.groupCollapsed(messages.strategyStart('NetworkFirst', request));

        for (let log of logs) {
          logger_mjs.logger.log(log);
        }

        messages.printFinalResponse(response);
        logger_mjs.logger.groupEnd();
      }

      if (!response) {
        throw new WorkboxError_mjs.WorkboxError('no-response', {
          url: request.url
        });
      }

      return response;
    }
    /**
     * @param {Object} options
     * @param {Request} options.request
     * @param {Array} options.logs A reference to the logs array
     * @param {Event} [options.event]
     * @return {Promise<Response>}
     *
     * @private
     */


    _getTimeoutPromise({
      request,
      logs,
      event
    }) {
      let timeoutId;
      const timeoutPromise = new Promise(resolve => {
        const onNetworkTimeout = async () => {
          {
            logs.push(`Timing out the network response at ` + `${this._networkTimeoutSeconds} seconds.`);
          }

          resolve((await this._respondFromCache({
            request,
            event
          })));
        };

        timeoutId = setTimeout(onNetworkTimeout, this._networkTimeoutSeconds * 1000);
      });
      return {
        promise: timeoutPromise,
        id: timeoutId
      };
    }
    /**
     * @param {Object} options
     * @param {number|undefined} options.timeoutId
     * @param {Request} options.request
     * @param {Array} options.logs A reference to the logs Array.
     * @param {Event} [options.event]
     * @return {Promise<Response>}
     *
     * @private
     */


    async _getNetworkPromise({
      timeoutId,
      request,
      logs,
      event
    }) {
      let error;
      let response;

      try {
        response = await fetchWrapper_mjs.fetchWrapper.fetch({
          request,
          event,
          fetchOptions: this._fetchOptions,
          plugins: this._plugins
        });
      } catch (err) {
        error = err;
      }

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      {
        if (response) {
          logs.push(`Got response from network.`);
        } else {
          logs.push(`Unable to get a response from the network. Will respond ` + `with a cached response.`);
        }
      }

      if (error || !response) {
        response = await this._respondFromCache({
          request,
          event
        });

        {
          if (response) {
            logs.push(`Found a cached response in the '${this._cacheName}'` + ` cache.`);
          } else {
            logs.push(`No response found in the '${this._cacheName}' cache.`);
          }
        }
      } else {
        // Keep the service worker alive while we put the request in the cache
        const responseClone = response.clone();
        const cachePut = cacheWrapper_mjs.cacheWrapper.put({
          cacheName: this._cacheName,
          request,
          response: responseClone,
          event,
          plugins: this._plugins
        });

        if (event) {
          try {
            // The event has been responded to so we can keep the SW alive to
            // respond to the request
            event.waitUntil(cachePut);
          } catch (err) {
            {
              logger_mjs.logger.warn(`Unable to ensure service worker stays alive when ` + `updating cache for '${getFriendlyURL_mjs.getFriendlyURL(request.url)}'.`);
            }
          }
        }
      }

      return response;
    }
    /**
     * Used if the network timeouts or fails to make the request.
     *
     * @param {Object} options
     * @param {Request} request The request to match in the cache
     * @param {Event} [options.event]
     * @return {Promise<Object>}
     *
     * @private
     */


    _respondFromCache({
      event,
      request
    }) {
      return cacheWrapper_mjs.cacheWrapper.match({
        cacheName: this._cacheName,
        request,
        event,
        matchOptions: this._matchOptions,
        plugins: this._plugins
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
   * An implementation of a
   * [network-only]{@link https://developers.google.com/web/fundamentals/instant-and-offline/offline-cookbook/#network-only}
   * request strategy.
   *
   * This class is useful if you want to take advantage of any
   * [Workbox plugins]{@link https://developers.google.com/web/tools/workbox/guides/using-plugins}.
   *
   * If the network request fails, this will throw a `WorkboxError` exception.
   *
   * @memberof workbox.strategies
   */

  class NetworkOnly {
    /**
     * @param {Object} options
     * @param {string} options.cacheName Cache name to store and retrieve
     * requests. Defaults to cache names provided by
     * [workbox-core]{@link workbox.core.cacheNames}.
     * @param {Array<Object>} options.plugins [Plugins]{@link https://developers.google.com/web/tools/workbox/guides/using-plugins}
     * to use in conjunction with this caching strategy.
     * @param {Object} options.fetchOptions Values passed along to the
     * [`init`](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters)
     * of all fetch() requests made by this strategy.
     */
    constructor(options = {}) {
      this._cacheName = cacheNames_mjs.cacheNames.getRuntimeName(options.cacheName);
      this._plugins = options.plugins || [];
      this._fetchOptions = options.fetchOptions || null;
    }
    /**
     * This method will perform a request strategy and follows an API that
     * will work with the
     * [Workbox Router]{@link workbox.routing.Router}.
     *
     * @param {Object} options
     * @param {Request} options.request The request to run this strategy for.
     * @param {Event} [options.event] The event that triggered the request.
     * @return {Promise<Response>}
     */


    async handle({
      event,
      request
    }) {
      return this.makeRequest({
        event,
        request: request || event.request
      });
    }
    /**
     * This method can be used to perform a make a standalone request outside the
     * context of the [Workbox Router]{@link workbox.routing.Router}.
     *
     * See "[Advanced Recipes](https://developers.google.com/web/tools/workbox/guides/advanced-recipes#make-requests)"
     * for more usage information.
     *
     * @param {Object} options
     * @param {Request|string} options.request Either a
     *     [`Request`]{@link https://developer.mozilla.org/en-US/docs/Web/API/Request}
     *     object, or a string URL, corresponding to the request to be made.
     * @param {FetchEvent} [options.event] If provided, `event.waitUntil()` will
     *     be called automatically to extend the service worker's lifetime.
     * @return {Promise<Response>}
     */


    async makeRequest({
      event,
      request
    }) {
      if (typeof request === 'string') {
        request = new Request(request);
      }

      {
        assert_mjs.assert.isInstance(request, Request, {
          moduleName: 'workbox-strategies',
          className: 'NetworkOnly',
          funcName: 'handle',
          paramName: 'request'
        });
      }

      let error;
      let response;

      try {
        response = await fetchWrapper_mjs.fetchWrapper.fetch({
          request,
          event,
          fetchOptions: this._fetchOptions,
          plugins: this._plugins
        });
      } catch (err) {
        error = err;
      }

      {
        logger_mjs.logger.groupCollapsed(messages.strategyStart('NetworkOnly', request));

        if (response) {
          logger_mjs.logger.log(`Got response from network.`);
        } else {
          logger_mjs.logger.log(`Unable to get a response from the network.`);
        }

        messages.printFinalResponse(response);
        logger_mjs.logger.groupEnd();
      }

      if (!response) {
        throw new WorkboxError_mjs.WorkboxError('no-response', {
          url: request.url,
          error
        });
      }

      return response;
    }

  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * An implementation of a
   * [stale-while-revalidate]{@link https://developers.google.com/web/fundamentals/instant-and-offline/offline-cookbook/#stale-while-revalidate}
   * request strategy.
   *
   * Resources are requested from both the cache and the network in parallel.
   * The strategy will respond with the cached version if available, otherwise
   * wait for the network response. The cache is updated with the network response
   * with each successful request.
   *
   * By default, this strategy will cache responses with a 200 status code as
   * well as [opaque responses]{@link https://developers.google.com/web/tools/workbox/guides/handle-third-party-requests}.
   * Opaque responses are are cross-origin requests where the response doesn't
   * support [CORS]{@link https://enable-cors.org/}.
   *
   * If the network request fails, and there is no cache match, this will throw
   * a `WorkboxError` exception.
   *
   * @memberof workbox.strategies
   */

  class StaleWhileRevalidate {
    /**
     * @param {Object} options
     * @param {string} options.cacheName Cache name to store and retrieve
     * requests. Defaults to cache names provided by
     * [workbox-core]{@link workbox.core.cacheNames}.
     * @param {Array<Object>} options.plugins [Plugins]{@link https://developers.google.com/web/tools/workbox/guides/using-plugins}
     * to use in conjunction with this caching strategy.
     * @param {Object} options.fetchOptions Values passed along to the
     * [`init`](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters)
     * of all fetch() requests made by this strategy.
     * @param {Object} options.matchOptions [`CacheQueryOptions`](https://w3c.github.io/ServiceWorker/#dictdef-cachequeryoptions)
     */
    constructor(options = {}) {
      this._cacheName = cacheNames_mjs.cacheNames.getRuntimeName(options.cacheName);
      this._plugins = options.plugins || [];

      if (options.plugins) {
        let isUsingCacheWillUpdate = options.plugins.some(plugin => !!plugin.cacheWillUpdate);
        this._plugins = isUsingCacheWillUpdate ? options.plugins : [cacheOkAndOpaquePlugin, ...options.plugins];
      } else {
        // No plugins passed in, use the default plugin.
        this._plugins = [cacheOkAndOpaquePlugin];
      }

      this._fetchOptions = options.fetchOptions || null;
      this._matchOptions = options.matchOptions || null;
    }
    /**
     * This method will perform a request strategy and follows an API that
     * will work with the
     * [Workbox Router]{@link workbox.routing.Router}.
     *
     * @param {Object} options
     * @param {Request} options.request The request to run this strategy for.
     * @param {Event} [options.event] The event that triggered the request.
     * @return {Promise<Response>}
     */


    async handle({
      event,
      request
    }) {
      return this.makeRequest({
        event,
        request: request || event.request
      });
    }
    /**
     * This method can be used to perform a make a standalone request outside the
     * context of the [Workbox Router]{@link workbox.routing.Router}.
     *
     * See "[Advanced Recipes](https://developers.google.com/web/tools/workbox/guides/advanced-recipes#make-requests)"
     * for more usage information.
     *
     * @param {Object} options
     * @param {Request|string} options.request Either a
     *     [`Request`]{@link https://developer.mozilla.org/en-US/docs/Web/API/Request}
     *     object, or a string URL, corresponding to the request to be made.
     * @param {FetchEvent} [options.event] If provided, `event.waitUntil()` will
     *     be called automatically to extend the service worker's lifetime.
     * @return {Promise<Response>}
     */


    async makeRequest({
      event,
      request
    }) {
      const logs = [];

      if (typeof request === 'string') {
        request = new Request(request);
      }

      {
        assert_mjs.assert.isInstance(request, Request, {
          moduleName: 'workbox-strategies',
          className: 'StaleWhileRevalidate',
          funcName: 'handle',
          paramName: 'request'
        });
      }

      const fetchAndCachePromise = this._getFromNetwork({
        request,
        event
      });

      let response = await cacheWrapper_mjs.cacheWrapper.match({
        cacheName: this._cacheName,
        request,
        event,
        matchOptions: this._matchOptions,
        plugins: this._plugins
      });
      let error;

      if (response) {
        {
          logs.push(`Found a cached response in the '${this._cacheName}'` + ` cache. Will update with the network response in the background.`);
        }

        if (event) {
          try {
            event.waitUntil(fetchAndCachePromise);
          } catch (error) {
            {
              logger_mjs.logger.warn(`Unable to ensure service worker stays alive when ` + `updating cache for '${getFriendlyURL_mjs.getFriendlyURL(request.url)}'.`);
            }
          }
        }
      } else {
        {
          logs.push(`No response found in the '${this._cacheName}' cache. ` + `Will wait for the network response.`);
        }

        try {
          response = await fetchAndCachePromise;
        } catch (err) {
          error = err;
        }
      }

      {
        logger_mjs.logger.groupCollapsed(messages.strategyStart('StaleWhileRevalidate', request));

        for (let log of logs) {
          logger_mjs.logger.log(log);
        }

        messages.printFinalResponse(response);
        logger_mjs.logger.groupEnd();
      }

      if (!response) {
        throw new WorkboxError_mjs.WorkboxError('no-response', {
          url: request.url,
          error
        });
      }

      return response;
    }
    /**
     * @param {Object} options
     * @param {Request} options.request
     * @param {Event} [options.event]
     * @return {Promise<Response>}
     *
     * @private
     */


    async _getFromNetwork({
      request,
      event
    }) {
      const response = await fetchWrapper_mjs.fetchWrapper.fetch({
        request,
        event,
        fetchOptions: this._fetchOptions,
        plugins: this._plugins
      });
      const cachePutPromise = cacheWrapper_mjs.cacheWrapper.put({
        cacheName: this._cacheName,
        request,
        response: response.clone(),
        event,
        plugins: this._plugins
      });

      if (event) {
        try {
          event.waitUntil(cachePutPromise);
        } catch (error) {
          {
            logger_mjs.logger.warn(`Unable to ensure service worker stays alive when ` + `updating cache for '${getFriendlyURL_mjs.getFriendlyURL(request.url)}'.`);
          }
        }
      }

      return response;
    }

  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  const mapping = {
    cacheFirst: CacheFirst,
    cacheOnly: CacheOnly,
    networkFirst: NetworkFirst,
    networkOnly: NetworkOnly,
    staleWhileRevalidate: StaleWhileRevalidate
  };

  const deprecate = strategy => {
    const StrategyCtr = mapping[strategy];
    return options => {
      {
        const strategyCtrName = strategy[0].toUpperCase() + strategy.slice(1);
        logger_mjs.logger.warn(`The 'workbox.strategies.${strategy}()' function has been ` + `deprecated and will be removed in a future version of Workbox.\n` + `Please use 'new workbox.strategies.${strategyCtrName}()' instead.`);
      }

      return new StrategyCtr(options);
    };
  };
  /**
   * @function workbox.strategies.cacheFirst
   * @param {Object} options See the {@link workbox.strategies.CacheFirst}
   * constructor for more info.
   * @deprecated since v4.0.0
   */


  const cacheFirst = deprecate('cacheFirst');
  /**
   * @function workbox.strategies.cacheOnly
   * @param {Object} options See the {@link workbox.strategies.CacheOnly}
   * constructor for more info.
   * @deprecated since v4.0.0
   */

  const cacheOnly = deprecate('cacheOnly');
  /**
   * @function workbox.strategies.networkFirst
   * @param {Object} options See the {@link workbox.strategies.NetworkFirst}
   * constructor for more info.
   * @deprecated since v4.0.0
   */

  const networkFirst = deprecate('networkFirst');
  /**
   * @function workbox.strategies.networkOnly
   * @param {Object} options See the {@link workbox.strategies.NetworkOnly}
   * constructor for more info.
   * @deprecated since v4.0.0
   */

  const networkOnly = deprecate('networkOnly');
  /**
   * @function workbox.strategies.staleWhileRevalidate
   * @param {Object} options See the
   * {@link workbox.strategies.StaleWhileRevalidate} constructor for more info.
   * @deprecated since v4.0.0
   */

  const staleWhileRevalidate = deprecate('staleWhileRevalidate');

  exports.CacheFirst = CacheFirst;
  exports.CacheOnly = CacheOnly;
  exports.NetworkFirst = NetworkFirst;
  exports.NetworkOnly = NetworkOnly;
  exports.StaleWhileRevalidate = StaleWhileRevalidate;
  exports.cacheFirst = cacheFirst;
  exports.cacheOnly = cacheOnly;
  exports.networkFirst = networkFirst;
  exports.networkOnly = networkOnly;
  exports.staleWhileRevalidate = staleWhileRevalidate;

  return exports;

}({}, workbox.core._private, workbox.core._private, workbox.core._private, workbox.core._private, workbox.core._private, workbox.core._private, workbox.core._private));
//# sourceMappingURL=workbox-strategies.dev.js.map
