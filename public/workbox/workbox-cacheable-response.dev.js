this.workbox = this.workbox || {};
this.workbox.cacheableResponse = (function (exports, WorkboxError_mjs, assert_mjs, getFriendlyURL_mjs, logger_mjs) {
  'use strict';

  try {
    self['workbox:cacheable-response:4.3.1'] && _();
  } catch (e) {} // eslint-disable-line

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * This class allows you to set up rules determining what
   * status codes and/or headers need to be present in order for a
   * [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
   * to be considered cacheable.
   *
   * @memberof workbox.cacheableResponse
   */

  class CacheableResponse {
    /**
     * To construct a new CacheableResponse instance you must provide at least
     * one of the `config` properties.
     *
     * If both `statuses` and `headers` are specified, then both conditions must
     * be met for the `Response` to be considered cacheable.
     *
     * @param {Object} config
     * @param {Array<number>} [config.statuses] One or more status codes that a
     * `Response` can have and be considered cacheable.
     * @param {Object<string,string>} [config.headers] A mapping of header names
     * and expected values that a `Response` can have and be considered cacheable.
     * If multiple headers are provided, only one needs to be present.
     */
    constructor(config = {}) {
      {
        if (!(config.statuses || config.headers)) {
          throw new WorkboxError_mjs.WorkboxError('statuses-or-headers-required', {
            moduleName: 'workbox-cacheable-response',
            className: 'CacheableResponse',
            funcName: 'constructor'
          });
        }

        if (config.statuses) {
          assert_mjs.assert.isArray(config.statuses, {
            moduleName: 'workbox-cacheable-response',
            className: 'CacheableResponse',
            funcName: 'constructor',
            paramName: 'config.statuses'
          });
        }

        if (config.headers) {
          assert_mjs.assert.isType(config.headers, 'object', {
            moduleName: 'workbox-cacheable-response',
            className: 'CacheableResponse',
            funcName: 'constructor',
            paramName: 'config.headers'
          });
        }
      }

      this._statuses = config.statuses;
      this._headers = config.headers;
    }
    /**
     * Checks a response to see whether it's cacheable or not, based on this
     * object's configuration.
     *
     * @param {Response} response The response whose cacheability is being
     * checked.
     * @return {boolean} `true` if the `Response` is cacheable, and `false`
     * otherwise.
     */


    isResponseCacheable(response) {
      {
        assert_mjs.assert.isInstance(response, Response, {
          moduleName: 'workbox-cacheable-response',
          className: 'CacheableResponse',
          funcName: 'isResponseCacheable',
          paramName: 'response'
        });
      }

      let cacheable = true;

      if (this._statuses) {
        cacheable = this._statuses.includes(response.status);
      }

      if (this._headers && cacheable) {
        cacheable = Object.keys(this._headers).some(headerName => {
          return response.headers.get(headerName) === this._headers[headerName];
        });
      }

      {
        if (!cacheable) {
          logger_mjs.logger.groupCollapsed(`The request for ` + `'${getFriendlyURL_mjs.getFriendlyURL(response.url)}' returned a response that does ` + `not meet the criteria for being cached.`);
          logger_mjs.logger.groupCollapsed(`View cacheability criteria here.`);
          logger_mjs.logger.log(`Cacheable statuses: ` + JSON.stringify(this._statuses));
          logger_mjs.logger.log(`Cacheable headers: ` + JSON.stringify(this._headers, null, 2));
          logger_mjs.logger.groupEnd();
          const logFriendlyHeaders = {};
          response.headers.forEach((value, key) => {
            logFriendlyHeaders[key] = value;
          });
          logger_mjs.logger.groupCollapsed(`View response status and headers here.`);
          logger_mjs.logger.log(`Response status: ` + response.status);
          logger_mjs.logger.log(`Response headers: ` + JSON.stringify(logFriendlyHeaders, null, 2));
          logger_mjs.logger.groupEnd();
          logger_mjs.logger.groupCollapsed(`View full response details here.`);
          logger_mjs.logger.log(response.headers);
          logger_mjs.logger.log(response);
          logger_mjs.logger.groupEnd();
          logger_mjs.logger.groupEnd();
        }
      }

      return cacheable;
    }

  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * A class implementing the `cacheWillUpdate` lifecycle callback. This makes it
   * easier to add in cacheability checks to requests made via Workbox's built-in
   * strategies.
   *
   * @memberof workbox.cacheableResponse
   */

  class Plugin {
    /**
     * To construct a new cacheable response Plugin instance you must provide at
     * least one of the `config` properties.
     *
     * If both `statuses` and `headers` are specified, then both conditions must
     * be met for the `Response` to be considered cacheable.
     *
     * @param {Object} config
     * @param {Array<number>} [config.statuses] One or more status codes that a
     * `Response` can have and be considered cacheable.
     * @param {Object<string,string>} [config.headers] A mapping of header names
     * and expected values that a `Response` can have and be considered cacheable.
     * If multiple headers are provided, only one needs to be present.
     */
    constructor(config) {
      this._cacheableResponse = new CacheableResponse(config);
    }
    /**
     * @param {Object} options
     * @param {Response} options.response
     * @return {boolean}
     * @private
     */


    cacheWillUpdate({
      response
    }) {
      if (this._cacheableResponse.isResponseCacheable(response)) {
        return response;
      }

      return null;
    }

  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */

  exports.CacheableResponse = CacheableResponse;
  exports.Plugin = Plugin;

  return exports;

}({}, workbox.core._private, workbox.core._private, workbox.core._private, workbox.core._private));
//# sourceMappingURL=workbox-cacheable-response.dev.js.map
