this.workbox = this.workbox || {};
this.workbox.precaching = (function (exports, assert_mjs, cacheNames_mjs, getFriendlyURL_mjs, logger_mjs, cacheWrapper_mjs, fetchWrapper_mjs, WorkboxError_mjs) {
  'use strict';

  try {
    self['workbox:precaching:4.3.1'] && _();
  } catch (e) {} // eslint-disable-line

  /*
    Copyright 2019 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  const plugins = [];
  const precachePlugins = {
    /*
     * @return {Array}
     * @private
     */
    get() {
      return plugins;
    },

    /*
     * @param {Array} newPlugins
     * @private
     */
    add(newPlugins) {
      plugins.push(...newPlugins);
    }

  };

  /*
    Copyright 2019 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * Adds plugins to precaching.
   *
   * @param {Array<Object>} newPlugins
   *
   * @alias workbox.precaching.addPlugins
   */

  const addPlugins = newPlugins => {
    precachePlugins.add(newPlugins);
  };

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * @param {Response} response
   * @return {Response}
   *
   * @private
   * @memberof module:workbox-precaching
   */

  async function cleanRedirect(response) {
    const clonedResponse = response.clone(); // Not all browsers support the Response.body stream, so fall back
    // to reading the entire body into memory as a blob.

    const bodyPromise = 'body' in clonedResponse ? Promise.resolve(clonedResponse.body) : clonedResponse.blob();
    const body = await bodyPromise; // new Response() is happy when passed either a stream or a Blob.

    return new Response(body, {
      headers: clonedResponse.headers,
      status: clonedResponse.status,
      statusText: clonedResponse.statusText
    });
  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */

  const REVISION_SEARCH_PARAM = '__WB_REVISION__';
  /**
   * Converts a manifest entry into a versioned URL suitable for precaching.
   *
   * @param {Object} entry
   * @return {string} A URL with versioning info.
   *
   * @private
   * @memberof module:workbox-precaching
   */

  function createCacheKey(entry) {
    if (!entry) {
      throw new WorkboxError_mjs.WorkboxError('add-to-cache-list-unexpected-type', {
        entry
      });
    } // If a precache manifest entry is a string, it's assumed to be a versioned
    // URL, like '/app.abcd1234.js'. Return as-is.


    if (typeof entry === 'string') {
      const urlObject = new URL(entry, location);
      return {
        cacheKey: urlObject.href,
        url: urlObject.href
      };
    }

    const {
      revision,
      url
    } = entry;

    if (!url) {
      throw new WorkboxError_mjs.WorkboxError('add-to-cache-list-unexpected-type', {
        entry
      });
    } // If there's just a URL and no revision, then it's also assumed to be a
    // versioned URL.


    if (!revision) {
      const urlObject = new URL(url, location);
      return {
        cacheKey: urlObject.href,
        url: urlObject.href
      };
    } // Otherwise, construct a properly versioned URL using the custom Workbox
    // search parameter along with the revision info.


    const originalURL = new URL(url, location);
    const cacheKeyURL = new URL(url, location);
    cacheKeyURL.searchParams.set(REVISION_SEARCH_PARAM, revision);
    return {
      cacheKey: cacheKeyURL.href,
      url: originalURL.href
    };
  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */

  const logGroup = (groupTitle, deletedURLs) => {
    logger_mjs.logger.groupCollapsed(groupTitle);

    for (const url of deletedURLs) {
      logger_mjs.logger.log(url);
    }

    logger_mjs.logger.groupEnd();
  };
  /**
   * @param {Array<string>} deletedURLs
   *
   * @private
   * @memberof module:workbox-precaching
   */


  function printCleanupDetails(deletedURLs) {
    const deletionCount = deletedURLs.length;

    if (deletionCount > 0) {
      logger_mjs.logger.groupCollapsed(`During precaching cleanup, ` + `${deletionCount} cached ` + `request${deletionCount === 1 ? ' was' : 's were'} deleted.`);
      logGroup('Deleted Cache Requests', deletedURLs);
      logger_mjs.logger.groupEnd();
    }
  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * @param {string} groupTitle
   * @param {Array<string>} urls
   *
   * @private
   */

  function _nestedGroup(groupTitle, urls) {
    if (urls.length === 0) {
      return;
    }

    logger_mjs.logger.groupCollapsed(groupTitle);

    for (const url of urls) {
      logger_mjs.logger.log(url);
    }

    logger_mjs.logger.groupEnd();
  }
  /**
   * @param {Array<string>} urlsToPrecache
   * @param {Array<string>} urlsAlreadyPrecached
   *
   * @private
   * @memberof module:workbox-precaching
   */


  function printInstallDetails(urlsToPrecache, urlsAlreadyPrecached) {
    const precachedCount = urlsToPrecache.length;
    const alreadyPrecachedCount = urlsAlreadyPrecached.length;

    if (precachedCount || alreadyPrecachedCount) {
      let message = `Precaching ${precachedCount} file${precachedCount === 1 ? '' : 's'}.`;

      if (alreadyPrecachedCount > 0) {
        message += ` ${alreadyPrecachedCount} ` + `file${alreadyPrecachedCount === 1 ? ' is' : 's are'} already cached.`;
      }

      logger_mjs.logger.groupCollapsed(message);

      _nestedGroup(`View newly precached URLs.`, urlsToPrecache);

      _nestedGroup(`View previously precached URLs.`, urlsAlreadyPrecached);

      logger_mjs.logger.groupEnd();
    }
  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * Performs efficient precaching of assets.
   *
   * @memberof module:workbox-precaching
   */

  class PrecacheController {
    /**
     * Create a new PrecacheController.
     *
     * @param {string} [cacheName] An optional name for the cache, to override
     * the default precache name.
     */
    constructor(cacheName) {
      this._cacheName = cacheNames_mjs.cacheNames.getPrecacheName(cacheName);
      this._urlsToCacheKeys = new Map();
    }
    /**
     * This method will add items to the precache list, removing duplicates
     * and ensuring the information is valid.
     *
     * @param {
     * Array<module:workbox-precaching.PrecacheController.PrecacheEntry|string>
     * } entries Array of entries to precache.
     */


    addToCacheList(entries) {
      {
        assert_mjs.assert.isArray(entries, {
          moduleName: 'workbox-precaching',
          className: 'PrecacheController',
          funcName: 'addToCacheList',
          paramName: 'entries'
        });
      }

      for (const entry of entries) {
        const {
          cacheKey,
          url
        } = createCacheKey(entry);

        if (this._urlsToCacheKeys.has(url) && this._urlsToCacheKeys.get(url) !== cacheKey) {
          throw new WorkboxError_mjs.WorkboxError('add-to-cache-list-conflicting-entries', {
            firstEntry: this._urlsToCacheKeys.get(url),
            secondEntry: cacheKey
          });
        }

        this._urlsToCacheKeys.set(url, cacheKey);
      }
    }
    /**
     * Precaches new and updated assets. Call this method from the service worker
     * install event.
     *
     * @param {Object} options
     * @param {Event} [options.event] The install event (if needed).
     * @param {Array<Object>} [options.plugins] Plugins to be used for fetching
     * and caching during install.
     * @return {Promise<workbox.precaching.InstallResult>}
     */


    async install({
      event,
      plugins
    } = {}) {
      {
        if (plugins) {
          assert_mjs.assert.isArray(plugins, {
            moduleName: 'workbox-precaching',
            className: 'PrecacheController',
            funcName: 'install',
            paramName: 'plugins'
          });
        }
      }

      const urlsToPrecache = [];
      const urlsAlreadyPrecached = [];
      const cache = await caches.open(this._cacheName);
      const alreadyCachedRequests = await cache.keys();
      const alreadyCachedURLs = new Set(alreadyCachedRequests.map(request => request.url));

      for (const cacheKey of this._urlsToCacheKeys.values()) {
        if (alreadyCachedURLs.has(cacheKey)) {
          urlsAlreadyPrecached.push(cacheKey);
        } else {
          urlsToPrecache.push(cacheKey);
        }
      }

      const precacheRequests = urlsToPrecache.map(url => {
        return this._addURLToCache({
          event,
          plugins,
          url
        });
      });
      await Promise.all(precacheRequests);

      {
        printInstallDetails(urlsToPrecache, urlsAlreadyPrecached);
      }

      return {
        updatedURLs: urlsToPrecache,
        notUpdatedURLs: urlsAlreadyPrecached
      };
    }
    /**
     * Deletes assets that are no longer present in the current precache manifest.
     * Call this method from the service worker activate event.
     *
     * @return {Promise<workbox.precaching.CleanupResult>}
     */


    async activate() {
      const cache = await caches.open(this._cacheName);
      const currentlyCachedRequests = await cache.keys();
      const expectedCacheKeys = new Set(this._urlsToCacheKeys.values());
      const deletedURLs = [];

      for (const request of currentlyCachedRequests) {
        if (!expectedCacheKeys.has(request.url)) {
          await cache.delete(request);
          deletedURLs.push(request.url);
        }
      }

      {
        printCleanupDetails(deletedURLs);
      }

      return {
        deletedURLs
      };
    }
    /**
     * Requests the entry and saves it to the cache if the response is valid.
     * By default, any response with a status code of less than 400 (including
     * opaque responses) is considered valid.
     *
     * If you need to use custom criteria to determine what's valid and what
     * isn't, then pass in an item in `options.plugins` that implements the
     * `cacheWillUpdate()` lifecycle event.
     *
     * @private
     * @param {Object} options
     * @param {string} options.url The URL to fetch and cache.
     * @param {Event} [options.event] The install event (if passed).
     * @param {Array<Object>} [options.plugins] An array of plugins to apply to
     * fetch and caching.
     */


    async _addURLToCache({
      url,
      event,
      plugins
    }) {
      const request = new Request(url, {
        credentials: 'same-origin'
      });
      let response = await fetchWrapper_mjs.fetchWrapper.fetch({
        event,
        plugins,
        request
      }); // Allow developers to override the default logic about what is and isn't
      // valid by passing in a plugin implementing cacheWillUpdate(), e.g.
      // a workbox.cacheableResponse.Plugin instance.

      let cacheWillUpdateCallback;

      for (const plugin of plugins || []) {
        if ('cacheWillUpdate' in plugin) {
          cacheWillUpdateCallback = plugin.cacheWillUpdate.bind(plugin);
        }
      }

      const isValidResponse = cacheWillUpdateCallback ? // Use a callback if provided. It returns a truthy value if valid.
      cacheWillUpdateCallback({
        event,
        request,
        response
      }) : // Otherwise, default to considering any response status under 400 valid.
      // This includes, by default, considering opaque responses valid.
      response.status < 400; // Consider this a failure, leading to the `install` handler failing, if
      // we get back an invalid response.

      if (!isValidResponse) {
        throw new WorkboxError_mjs.WorkboxError('bad-precaching-response', {
          url,
          status: response.status
        });
      }

      if (response.redirected) {
        response = await cleanRedirect(response);
      }

      await cacheWrapper_mjs.cacheWrapper.put({
        event,
        plugins,
        request,
        response,
        cacheName: this._cacheName,
        matchOptions: {
          ignoreSearch: true
        }
      });
    }
    /**
     * Returns a mapping of a precached URL to the corresponding cache key, taking
     * into account the revision information for the URL.
     *
     * @return {Map<string, string>} A URL to cache key mapping.
     */


    getURLsToCacheKeys() {
      return this._urlsToCacheKeys;
    }
    /**
     * Returns a list of all the URLs that have been precached by the current
     * service worker.
     *
     * @return {Array<string>} The precached URLs.
     */


    getCachedURLs() {
      return [...this._urlsToCacheKeys.keys()];
    }
    /**
     * Returns the cache key used for storing a given URL. If that URL is
     * unversioned, like `/index.html', then the cache key will be the original
     * URL with a search parameter appended to it.
     *
     * @param {string} url A URL whose cache key you want to look up.
     * @return {string} The versioned URL that corresponds to a cache key
     * for the original URL, or undefined if that URL isn't precached.
     */


    getCacheKeyForURL(url) {
      const urlObject = new URL(url, location);
      return this._urlsToCacheKeys.get(urlObject.href);
    }

  }

  /*
    Copyright 2019 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  let precacheController;
  /**
   * @return {PrecacheController}
   * @private
   */

  const getOrCreatePrecacheController = () => {
    if (!precacheController) {
      precacheController = new PrecacheController();
    }

    return precacheController;
  };

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * Removes any URL search parameters that should be ignored.
   *
   * @param {URL} urlObject The original URL.
   * @param {Array<RegExp>} ignoreURLParametersMatching RegExps to test against
   * each search parameter name. Matches mean that the search parameter should be
   * ignored.
   * @return {URL} The URL with any ignored search parameters removed.
   *
   * @private
   * @memberof module:workbox-precaching
   */

  function removeIgnoredSearchParams(urlObject, ignoreURLParametersMatching) {
    // Convert the iterable into an array at the start of the loop to make sure
    // deletion doesn't mess up iteration.
    for (const paramName of [...urlObject.searchParams.keys()]) {
      if (ignoreURLParametersMatching.some(regExp => regExp.test(paramName))) {
        urlObject.searchParams.delete(paramName);
      }
    }

    return urlObject;
  }

  /*
    Copyright 2019 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * Generator function that yields possible variations on the original URL to
   * check, one at a time.
   *
   * @param {string} url
   * @param {Object} options
   *
   * @private
   * @memberof module:workbox-precaching
   */

  function* generateURLVariations(url, {
    ignoreURLParametersMatching,
    directoryIndex,
    cleanURLs,
    urlManipulation
  } = {}) {
    const urlObject = new URL(url, location);
    urlObject.hash = '';
    yield urlObject.href;
    const urlWithoutIgnoredParams = removeIgnoredSearchParams(urlObject, ignoreURLParametersMatching);
    yield urlWithoutIgnoredParams.href;

    if (directoryIndex && urlWithoutIgnoredParams.pathname.endsWith('/')) {
      const directoryURL = new URL(urlWithoutIgnoredParams);
      directoryURL.pathname += directoryIndex;
      yield directoryURL.href;
    }

    if (cleanURLs) {
      const cleanURL = new URL(urlWithoutIgnoredParams);
      cleanURL.pathname += '.html';
      yield cleanURL.href;
    }

    if (urlManipulation) {
      const additionalURLs = urlManipulation({
        url: urlObject
      });

      for (const urlToAttempt of additionalURLs) {
        yield urlToAttempt.href;
      }
    }
  }

  /*
    Copyright 2019 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * This function will take the request URL and manipulate it based on the
   * configuration options.
   *
   * @param {string} url
   * @param {Object} options
   * @return {string} Returns the URL in the cache that matches the request,
   * if possible.
   *
   * @private
   */

  const getCacheKeyForURL = (url, options) => {
    const precacheController = getOrCreatePrecacheController();
    const urlsToCacheKeys = precacheController.getURLsToCacheKeys();

    for (const possibleURL of generateURLVariations(url, options)) {
      const possibleCacheKey = urlsToCacheKeys.get(possibleURL);

      if (possibleCacheKey) {
        return possibleCacheKey;
      }
    }
  };

  /*
    Copyright 2019 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * Adds a `fetch` listener to the service worker that will
   * respond to
   * [network requests]{@link https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers#Custom_responses_to_requests}
   * with precached assets.
   *
   * Requests for assets that aren't precached, the `FetchEvent` will not be
   * responded to, allowing the event to fall through to other `fetch` event
   * listeners.
   *
   * NOTE: when called more than once this method will replace the previously set
   * configuration options. Calling it more than once is not recommended outside
   * of tests.
   *
   * @private
   * @param {Object} options
   * @param {string} [options.directoryIndex=index.html] The `directoryIndex` will
   * check cache entries for a URLs ending with '/' to see if there is a hit when
   * appending the `directoryIndex` value.
   * @param {Array<RegExp>} [options.ignoreURLParametersMatching=[/^utm_/]] An
   * array of regex's to remove search params when looking for a cache match.
   * @param {boolean} [options.cleanURLs=true] The `cleanURLs` option will
   * check the cache for the URL with a `.html` added to the end of the end.
   * @param {workbox.precaching~urlManipulation} [options.urlManipulation]
   * This is a function that should take a URL and return an array of
   * alternative URL's that should be checked for precache matches.
   */

  const addFetchListener = ({
    ignoreURLParametersMatching = [/^utm_/],
    directoryIndex = 'index.html',
    cleanURLs = true,
    urlManipulation = null
  } = {}) => {
    const cacheName = cacheNames_mjs.cacheNames.getPrecacheName();
    addEventListener('fetch', event => {
      const precachedURL = getCacheKeyForURL(event.request.url, {
        cleanURLs,
        directoryIndex,
        ignoreURLParametersMatching,
        urlManipulation
      });

      if (!precachedURL) {
        {
          logger_mjs.logger.debug(`Precaching did not find a match for ` + getFriendlyURL_mjs.getFriendlyURL(event.request.url));
        }

        return;
      }

      let responsePromise = caches.open(cacheName).then(cache => {
        return cache.match(precachedURL);
      }).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        } // Fall back to the network if we don't have a cached response
        // (perhaps due to manual cache cleanup).


        {
          logger_mjs.logger.warn(`The precached response for ` + `${getFriendlyURL_mjs.getFriendlyURL(precachedURL)} in ${cacheName} was not found. ` + `Falling back to the network instead.`);
        }

        return fetch(precachedURL);
      });

      {
        responsePromise = responsePromise.then(response => {
          // Workbox is going to handle the route.
          // print the routing details to the console.
          logger_mjs.logger.groupCollapsed(`Precaching is responding to: ` + getFriendlyURL_mjs.getFriendlyURL(event.request.url));
          logger_mjs.logger.log(`Serving the precached url: ${precachedURL}`);
          logger_mjs.logger.groupCollapsed(`View request details here.`);
          logger_mjs.logger.log(event.request);
          logger_mjs.logger.groupEnd();
          logger_mjs.logger.groupCollapsed(`View response details here.`);
          logger_mjs.logger.log(response);
          logger_mjs.logger.groupEnd();
          logger_mjs.logger.groupEnd();
          return response;
        });
      }

      event.respondWith(responsePromise);
    });
  };

  /*
    Copyright 2019 Google LLC
    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  let listenerAdded = false;
  /**
   * Add a `fetch` listener to the service worker that will
   * respond to
   * [network requests]{@link https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers#Custom_responses_to_requests}
   * with precached assets.
   *
   * Requests for assets that aren't precached, the `FetchEvent` will not be
   * responded to, allowing the event to fall through to other `fetch` event
   * listeners.
   *
   * @param {Object} options
   * @param {string} [options.directoryIndex=index.html] The `directoryIndex` will
   * check cache entries for a URLs ending with '/' to see if there is a hit when
   * appending the `directoryIndex` value.
   * @param {Array<RegExp>} [options.ignoreURLParametersMatching=[/^utm_/]] An
   * array of regex's to remove search params when looking for a cache match.
   * @param {boolean} [options.cleanURLs=true] The `cleanURLs` option will
   * check the cache for the URL with a `.html` added to the end of the end.
   * @param {workbox.precaching~urlManipulation} [options.urlManipulation]
   * This is a function that should take a URL and return an array of
   * alternative URL's that should be checked for precache matches.
   *
   * @alias workbox.precaching.addRoute
   */

  const addRoute = options => {
    if (!listenerAdded) {
      addFetchListener(options);
      listenerAdded = true;
    }
  };

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  const SUBSTRING_TO_FIND = '-precache-';
  /**
   * Cleans up incompatible precaches that were created by older versions of
   * Workbox, by a service worker registered under the current scope.
   *
   * This is meant to be called as part of the `activate` event.
   *
   * This should be safe to use as long as you don't include `substringToFind`
   * (defaulting to `-precache-`) in your non-precache cache names.
   *
   * @param {string} currentPrecacheName The cache name currently in use for
   * precaching. This cache won't be deleted.
   * @param {string} [substringToFind='-precache-'] Cache names which include this
   * substring will be deleted (excluding `currentPrecacheName`).
   * @return {Array<string>} A list of all the cache names that were deleted.
   *
   * @private
   * @memberof module:workbox-precaching
   */

  const deleteOutdatedCaches = async (currentPrecacheName, substringToFind = SUBSTRING_TO_FIND) => {
    const cacheNames = await caches.keys();
    const cacheNamesToDelete = cacheNames.filter(cacheName => {
      return cacheName.includes(substringToFind) && cacheName.includes(self.registration.scope) && cacheName !== currentPrecacheName;
    });
    await Promise.all(cacheNamesToDelete.map(cacheName => caches.delete(cacheName)));
    return cacheNamesToDelete;
  };

  /*
    Copyright 2019 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * Adds an `activate` event listener which will clean up incompatible
   * precaches that were created by older versions of Workbox.
   *
   * @alias workbox.precaching.cleanupOutdatedCaches
   */

  const cleanupOutdatedCaches = () => {
    addEventListener('activate', event => {
      const cacheName = cacheNames_mjs.cacheNames.getPrecacheName();
      event.waitUntil(deleteOutdatedCaches(cacheName).then(cachesDeleted => {
        {
          if (cachesDeleted.length > 0) {
            logger_mjs.logger.log(`The following out-of-date precaches were cleaned up ` + `automatically:`, cachesDeleted);
          }
        }
      }));
    });
  };

  /*
    Copyright 2019 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * Takes in a URL, and returns the corresponding URL that could be used to
   * lookup the entry in the precache.
   *
   * If a relative URL is provided, the location of the service worker file will
   * be used as the base.
   *
   * For precached entries without revision information, the cache key will be the
   * same as the original URL.
   *
   * For precached entries with revision information, the cache key will be the
   * original URL with the addition of a query parameter used for keeping track of
   * the revision info.
   *
   * @param {string} url The URL whose cache key to look up.
   * @return {string} The cache key that corresponds to that URL.
   *
   * @alias workbox.precaching.getCacheKeyForURL
   */

  const getCacheKeyForURL$1 = url => {
    const precacheController = getOrCreatePrecacheController();
    return precacheController.getCacheKeyForURL(url);
  };

  /*
    Copyright 2019 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */

  const installListener = event => {
    const precacheController = getOrCreatePrecacheController();
    const plugins = precachePlugins.get();
    event.waitUntil(precacheController.install({
      event,
      plugins
    }).catch(error => {
      {
        logger_mjs.logger.error(`Service worker installation failed. It will ` + `be retried automatically during the next navigation.`);
      } // Re-throw the error to ensure installation fails.


      throw error;
    }));
  };

  const activateListener = event => {
    const precacheController = getOrCreatePrecacheController();
    const plugins = precachePlugins.get();
    event.waitUntil(precacheController.activate({
      event,
      plugins
    }));
  };
  /**
   * Adds items to the precache list, removing any duplicates and
   * stores the files in the
   * ["precache cache"]{@link module:workbox-core.cacheNames} when the service
   * worker installs.
   *
   * This method can be called multiple times.
   *
   * Please note: This method **will not** serve any of the cached files for you.
   * It only precaches files. To respond to a network request you call
   * [addRoute()]{@link module:workbox-precaching.addRoute}.
   *
   * If you have a single array of files to precache, you can just call
   * [precacheAndRoute()]{@link module:workbox-precaching.precacheAndRoute}.
   *
   * @param {Array<Object|string>} entries Array of entries to precache.
   *
   * @alias workbox.precaching.precache
   */


  const precache = entries => {
    const precacheController = getOrCreatePrecacheController();
    precacheController.addToCacheList(entries);

    if (entries.length > 0) {
      // NOTE: these listeners will only be added once (even if the `precache()`
      // method is called multiple times) because event listeners are implemented
      // as a set, where each listener must be unique.
      addEventListener('install', installListener);
      addEventListener('activate', activateListener);
    }
  };

  /*
    Copyright 2019 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * This method will add entries to the precache list and add a route to
   * respond to fetch events.
   *
   * This is a convenience method that will call
   * [precache()]{@link module:workbox-precaching.precache} and
   * [addRoute()]{@link module:workbox-precaching.addRoute} in a single call.
   *
   * @param {Array<Object|string>} entries Array of entries to precache.
   * @param {Object} options See
   * [addRoute() options]{@link module:workbox-precaching.addRoute}.
   *
   * @alias workbox.precaching.precacheAndRoute
   */

  const precacheAndRoute = (entries, options) => {
    precache(entries);
    addRoute(options);
  };

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */

  {
    assert_mjs.assert.isSWEnv('workbox-precaching');
  }

  exports.addPlugins = addPlugins;
  exports.addRoute = addRoute;
  exports.cleanupOutdatedCaches = cleanupOutdatedCaches;
  exports.getCacheKeyForURL = getCacheKeyForURL$1;
  exports.precache = precache;
  exports.precacheAndRoute = precacheAndRoute;
  exports.PrecacheController = PrecacheController;

  return exports;

}({}, workbox.core._private, workbox.core._private, workbox.core._private, workbox.core._private, workbox.core._private, workbox.core._private, workbox.core._private));
//# sourceMappingURL=workbox-precaching.dev.js.map
