this.workbox = this.workbox || {};
this.workbox.rangeRequests = (function (exports, WorkboxError_mjs, assert_mjs, logger_mjs) {
  'use strict';

  try {
    self['workbox:range-requests:4.3.1'] && _();
  } catch (e) {} // eslint-disable-line

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * @param {Blob} blob A source blob.
   * @param {number|null} start The offset to use as the start of the
   * slice.
   * @param {number|null} end The offset to use as the end of the slice.
   * @return {Object} An object with `start` and `end` properties, reflecting
   * the effective boundaries to use given the size of the blob.
   *
   * @private
   */

  function calculateEffectiveBoundaries(blob, start, end) {
    {
      assert_mjs.assert.isInstance(blob, Blob, {
        moduleName: 'workbox-range-requests',
        funcName: 'calculateEffectiveBoundaries',
        paramName: 'blob'
      });
    }

    const blobSize = blob.size;

    if (end > blobSize || start < 0) {
      throw new WorkboxError_mjs.WorkboxError('range-not-satisfiable', {
        size: blobSize,
        end,
        start
      });
    }

    let effectiveStart;
    let effectiveEnd;

    if (start === null) {
      effectiveStart = blobSize - end;
      effectiveEnd = blobSize;
    } else if (end === null) {
      effectiveStart = start;
      effectiveEnd = blobSize;
    } else {
      effectiveStart = start; // Range values are inclusive, so add 1 to the value.

      effectiveEnd = end + 1;
    }

    return {
      start: effectiveStart,
      end: effectiveEnd
    };
  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * @param {string} rangeHeader A Range: header value.
   * @return {Object} An object with `start` and `end` properties, reflecting
   * the parsed value of the Range: header. If either the `start` or `end` are
   * omitted, then `null` will be returned.
   *
   * @private
   */

  function parseRangeHeader(rangeHeader) {
    {
      assert_mjs.assert.isType(rangeHeader, 'string', {
        moduleName: 'workbox-range-requests',
        funcName: 'parseRangeHeader',
        paramName: 'rangeHeader'
      });
    }

    const normalizedRangeHeader = rangeHeader.trim().toLowerCase();

    if (!normalizedRangeHeader.startsWith('bytes=')) {
      throw new WorkboxError_mjs.WorkboxError('unit-must-be-bytes', {
        normalizedRangeHeader
      });
    } // Specifying multiple ranges separate by commas is valid syntax, but this
    // library only attempts to handle a single, contiguous sequence of bytes.
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range#Syntax


    if (normalizedRangeHeader.includes(',')) {
      throw new WorkboxError_mjs.WorkboxError('single-range-only', {
        normalizedRangeHeader
      });
    }

    const rangeParts = /(\d*)-(\d*)/.exec(normalizedRangeHeader); // We need either at least one of the start or end values.

    if (rangeParts === null || !(rangeParts[1] || rangeParts[2])) {
      throw new WorkboxError_mjs.WorkboxError('invalid-range-values', {
        normalizedRangeHeader
      });
    }

    return {
      start: rangeParts[1] === '' ? null : Number(rangeParts[1]),
      end: rangeParts[2] === '' ? null : Number(rangeParts[2])
    };
  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * Given a `Request` and `Response` objects as input, this will return a
   * promise for a new `Response`.
   *
   * If the original `Response` already contains partial content (i.e. it has
   * a status of 206), then this assumes it already fulfills the `Range:`
   * requirements, and will return it as-is.
   *
   * @param {Request} request A request, which should contain a Range:
   * header.
   * @param {Response} originalResponse A response.
   * @return {Promise<Response>} Either a `206 Partial Content` response, with
   * the response body set to the slice of content specified by the request's
   * `Range:` header, or a `416 Range Not Satisfiable` response if the
   * conditions of the `Range:` header can't be met.
   *
   * @memberof workbox.rangeRequests
   */

  async function createPartialResponse(request, originalResponse) {
    try {
      {
        assert_mjs.assert.isInstance(request, Request, {
          moduleName: 'workbox-range-requests',
          funcName: 'createPartialResponse',
          paramName: 'request'
        });
        assert_mjs.assert.isInstance(originalResponse, Response, {
          moduleName: 'workbox-range-requests',
          funcName: 'createPartialResponse',
          paramName: 'originalResponse'
        });
      }

      if (originalResponse.status === 206) {
        // If we already have a 206, then just pass it through as-is;
        // see https://github.com/GoogleChrome/workbox/issues/1720
        return originalResponse;
      }

      const rangeHeader = request.headers.get('range');

      if (!rangeHeader) {
        throw new WorkboxError_mjs.WorkboxError('no-range-header');
      }

      const boundaries = parseRangeHeader(rangeHeader);
      const originalBlob = await originalResponse.blob();
      const effectiveBoundaries = calculateEffectiveBoundaries(originalBlob, boundaries.start, boundaries.end);
      const slicedBlob = originalBlob.slice(effectiveBoundaries.start, effectiveBoundaries.end);
      const slicedBlobSize = slicedBlob.size;
      const slicedResponse = new Response(slicedBlob, {
        // Status code 206 is for a Partial Content response.
        // See https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/206
        status: 206,
        statusText: 'Partial Content',
        headers: originalResponse.headers
      });
      slicedResponse.headers.set('Content-Length', slicedBlobSize);
      slicedResponse.headers.set('Content-Range', `bytes ${effectiveBoundaries.start}-${effectiveBoundaries.end - 1}/` + originalBlob.size);
      return slicedResponse;
    } catch (error) {
      {
        logger_mjs.logger.warn(`Unable to construct a partial response; returning a ` + `416 Range Not Satisfiable response instead.`);
        logger_mjs.logger.groupCollapsed(`View details here.`);
        logger_mjs.logger.log(error);
        logger_mjs.logger.log(request);
        logger_mjs.logger.log(originalResponse);
        logger_mjs.logger.groupEnd();
      }

      return new Response('', {
        status: 416,
        statusText: 'Range Not Satisfiable'
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
   * The range request plugin makes it easy for a request with a 'Range' header to
   * be fulfilled by a cached response.
   *
   * It does this by intercepting the `cachedResponseWillBeUsed` plugin callback
   * and returning the appropriate subset of the cached response body.
   *
   * @memberof workbox.rangeRequests
   */

  class Plugin {
    /**
     * @param {Object} options
     * @param {Request} options.request The original request, which may or may not
     * contain a Range: header.
     * @param {Response} options.cachedResponse The complete cached response.
     * @return {Promise<Response>} If request contains a 'Range' header, then a
     * new response with status 206 whose body is a subset of `cachedResponse` is
     * returned. Otherwise, `cachedResponse` is returned as-is.
     *
     * @private
     */
    async cachedResponseWillBeUsed({
      request,
      cachedResponse
    }) {
      // Only return a sliced response if there's something valid in the cache,
      // and there's a Range: header in the request.
      if (cachedResponse && request.headers.has('range')) {
        return await createPartialResponse(request, cachedResponse);
      } // If there was no Range: header, or if cachedResponse wasn't valid, just
      // pass it through as-is.


      return cachedResponse;
    }

  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */

  exports.createPartialResponse = createPartialResponse;
  exports.Plugin = Plugin;

  return exports;

}({}, workbox.core._private, workbox.core._private, workbox.core._private));
//# sourceMappingURL=workbox-range-requests.dev.js.map
