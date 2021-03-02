this.workbox = this.workbox || {};
this.workbox.navigationPreload = (function (exports, logger_mjs) {
  'use strict';

  try {
    self['workbox:navigation-preload:4.3.1'] && _();
  } catch (e) {} // eslint-disable-line

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * @return {boolean} Whether or not the current browser supports enabling
   * navigation preload.
   *
   * @memberof workbox.navigationPreload
   */

  function isSupported() {
    return Boolean(self.registration && self.registration.navigationPreload);
  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * If the browser supports Navigation Preload, then this will disable it.
   *
   * @memberof workbox.navigationPreload
   */

  function disable() {
    if (isSupported()) {
      self.addEventListener('activate', event => {
        event.waitUntil(self.registration.navigationPreload.disable().then(() => {
          {
            logger_mjs.logger.log(`Navigation preload is disabled.`);
          }
        }));
      });
    } else {
      {
        logger_mjs.logger.log(`Navigation preload is not supported in this browser.`);
      }
    }
  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */
  /**
   * If the browser supports Navigation Preload, then this will enable it.
   *
   * @param {string} [headerValue] Optionally, allows developers to
   * [override](https://developers.google.com/web/updates/2017/02/navigation-preload#changing_the_header)
   * the value of the `Service-Worker-Navigation-Preload` header which will be
   * sent to the server when making the navigation request.
   *
   * @memberof workbox.navigationPreload
   */

  function enable(headerValue) {
    if (isSupported()) {
      self.addEventListener('activate', event => {
        event.waitUntil(self.registration.navigationPreload.enable().then(() => {
          // Defaults to Service-Worker-Navigation-Preload: true if not set.
          if (headerValue) {
            self.registration.navigationPreload.setHeaderValue(headerValue);
          }

          {
            logger_mjs.logger.log(`Navigation preload is enabled.`);
          }
        }));
      });
    } else {
      {
        logger_mjs.logger.log(`Navigation preload is not supported in this browser.`);
      }
    }
  }

  /*
    Copyright 2018 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
  */

  exports.disable = disable;
  exports.enable = enable;
  exports.isSupported = isSupported;

  return exports;

}({}, workbox.core._private));
//# sourceMappingURL=workbox-navigation-preload.dev.js.map
