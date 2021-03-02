this.workbox = this.workbox || {};
this.workbox.streams = (function (exports, logger_mjs, assert_mjs) {
  'use strict';

  try {
    self['workbox:streams:4.3.1'] && _();
  } catch (e) {} // eslint-disable-line

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * Takes either a Response, a ReadableStream, or a
   * [BodyInit](https://fetch.spec.whatwg.org/#bodyinit) and returns the
   * ReadableStreamReader object associated with it.
   *
   * @param {workbox.streams.StreamSource} source
   * @return {ReadableStreamReader}
   * @private
   */

  function _getReaderFromSource(source) {
    if (source.body && source.body.getReader) {
      return source.body.getReader();
    }

    if (source.getReader) {
      return source.getReader();
    } // TODO: This should be possible to do by constructing a ReadableStream, but
    // I can't get it to work. As a hack, construct a new Response, and use the
    // reader associated with its body.


    return new Response(source).body.getReader();
  }
  /**
   * Takes multiple source Promises, each of which could resolve to a Response, a
   * ReadableStream, or a [BodyInit](https://fetch.spec.whatwg.org/#bodyinit).
   *
   * Returns an object exposing a ReadableStream with each individual stream's
   * data returned in sequence, along with a Promise which signals when the
   * stream is finished (useful for passing to a FetchEvent's waitUntil()).
   *
   * @param {Array<Promise<workbox.streams.StreamSource>>} sourcePromises
   * @return {Object<{done: Promise, stream: ReadableStream}>}
   *
   * @memberof workbox.streams
   */


  function concatenate(sourcePromises) {
    {
      assert_mjs.assert.isArray(sourcePromises, {
        moduleName: 'workbox-streams',
        funcName: 'concatenate',
        paramName: 'sourcePromises'
      });
    }

    const readerPromises = sourcePromises.map(sourcePromise => {
      return Promise.resolve(sourcePromise).then(source => {
        return _getReaderFromSource(source);
      });
    });
    let fullyStreamedResolve;
    let fullyStreamedReject;
    const done = new Promise((resolve, reject) => {
      fullyStreamedResolve = resolve;
      fullyStreamedReject = reject;
    });
    let i = 0;
    const logMessages = [];
    const stream = new ReadableStream({
      pull(controller) {
        return readerPromises[i].then(reader => reader.read()).then(result => {
          if (result.done) {
            {
              logMessages.push(['Reached the end of source:', sourcePromises[i]]);
            }

            i++;

            if (i >= readerPromises.length) {
              // Log all the messages in the group at once in a single group.
              {
                logger_mjs.logger.groupCollapsed(`Concatenating ${readerPromises.length} sources.`);

                for (const message of logMessages) {
                  if (Array.isArray(message)) {
                    logger_mjs.logger.log(...message);
                  } else {
                    logger_mjs.logger.log(message);
                  }
                }

                logger_mjs.logger.log('Finished reading all sources.');
                logger_mjs.logger.groupEnd();
              }

              controller.close();
              fullyStreamedResolve();
              return;
            }

            return this.pull(controller);
          } else {
            controller.enqueue(result.value);
          }
        }).catch(error => {
          {
            logger_mjs.logger.error('An error occurred:', error);
          }

          fullyStreamedReject(error);
          throw error;
        });
      },

      cancel() {
        {
          logger_mjs.logger.warn('The ReadableStream was cancelled.');
        }

        fullyStreamedResolve();
      }

    });
    return {
      done,
      stream
    };
  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * This is a utility method that determines whether the current browser supports
   * the features required to create streamed responses. Currently, it checks if
   * [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/ReadableStream)
   * is available.
   *
   * @param {HeadersInit} [headersInit] If there's no `Content-Type` specified,
   * `'text/html'` will be used by default.
   * @return {boolean} `true`, if the current browser meets the requirements for
   * streaming responses, and `false` otherwise.
   *
   * @memberof workbox.streams
   */

  function createHeaders(headersInit = {}) {
    // See https://github.com/GoogleChrome/workbox/issues/1461
    const headers = new Headers(headersInit);

    if (!headers.has('content-type')) {
      headers.set('content-type', 'text/html');
    }

    return headers;
  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * Takes multiple source Promises, each of which could resolve to a Response, a
   * ReadableStream, or a [BodyInit](https://fetch.spec.whatwg.org/#bodyinit),
   * along with a
   * [HeadersInit](https://fetch.spec.whatwg.org/#typedefdef-headersinit).
   *
   * Returns an object exposing a Response whose body consists of each individual
   * stream's data returned in sequence, along with a Promise which signals when
   * the stream is finished (useful for passing to a FetchEvent's waitUntil()).
   *
   * @param {Array<Promise<workbox.streams.StreamSource>>} sourcePromises
   * @param {HeadersInit} [headersInit] If there's no `Content-Type` specified,
   * `'text/html'` will be used by default.
   * @return {Object<{done: Promise, response: Response}>}
   *
   * @memberof workbox.streams
   */

  function concatenateToResponse(sourcePromises, headersInit) {
    const {
      done,
      stream
    } = concatenate(sourcePromises);
    const headers = createHeaders(headersInit);
    const response = new Response(stream, {
      headers
    });
    return {
      done,
      response
    };
  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  let cachedIsSupported = undefined;
  /**
   * This is a utility method that determines whether the current browser supports
   * the features required to create streamed responses. Currently, it checks if
   * [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/ReadableStream)
   * can be created.
   *
   * @return {boolean} `true`, if the current browser meets the requirements for
   * streaming responses, and `false` otherwise.
   *
   * @memberof workbox.streams
   */

  function isSupported() {
    if (cachedIsSupported === undefined) {
      // See https://github.com/GoogleChrome/workbox/issues/1473
      try {
        new ReadableStream({
          start() {}

        });
        cachedIsSupported = true;
      } catch (error) {
        cachedIsSupported = false;
      }
    }

    return cachedIsSupported;
  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * A shortcut to create a strategy that could be dropped-in to Workbox's router.
   *
   * On browsers that do not support constructing new `ReadableStream`s, this
   * strategy will automatically wait for all the `sourceFunctions` to complete,
   * and create a final response that concatenates their values together.
   *
   * @param {
   *   Array<function(workbox.routing.Route~handlerCallback)>} sourceFunctions
   * Each function should return a {@link workbox.streams.StreamSource} (or a
   * Promise which resolves to one).
   * @param {HeadersInit} [headersInit] If there's no `Content-Type` specified,
   * `'text/html'` will be used by default.
   * @return {workbox.routing.Route~handlerCallback}
   *
   * @memberof workbox.streams
   */

  function strategy(sourceFunctions, headersInit) {
    return async ({
      event,
      url,
      params
    }) => {
      if (isSupported()) {
        const {
          done,
          response
        } = concatenateToResponse(sourceFunctions.map(fn => fn({
          event,
          url,
          params
        })), headersInit);
        event.waitUntil(done);
        return response;
      }

      {
        logger_mjs.logger.log(`The current browser doesn't support creating response ` + `streams. Falling back to non-streaming response instead.`);
      } // Fallback to waiting for everything to finish, and concatenating the
      // responses.


      const parts = await Promise.all(sourceFunctions.map(sourceFunction => sourceFunction({
        event,
        url,
        params
      })).map(async responsePromise => {
        const response = await responsePromise;

        if (response instanceof Response) {
          return response.blob();
        } // Otherwise, assume it's something like a string which can be used
        // as-is when constructing the final composite blob.


        return response;
      }));
      const headers = createHeaders(headersInit); // Constructing a new Response from a Blob source is well-supported.
      // So is constructing a new Blob from multiple source Blobs or strings.

      return new Response(new Blob(parts), {
        headers
      });
    };
  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */

  exports.concatenate = concatenate;
  exports.concatenateToResponse = concatenateToResponse;
  exports.isSupported = isSupported;
  exports.strategy = strategy;

  return exports;

}({}, workbox.core._private, workbox.core._private));
//# sourceMappingURL=workbox-streams.dev.js.map
