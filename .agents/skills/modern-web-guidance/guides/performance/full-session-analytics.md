# Reliably measure full-session analytics and telemetry

To reliably analytics and telemetry data that covers the entirety of a user's visit to a web page (not just until page load) use the `fetchLater()` API.

The `fetchLater()` API is the most reliably way to send data to a server in cases where a response is not required and delivery timing is not urgent, which applies to data such as user analytics, telemetry, error tracking, and performance metrics like Core Web Vitals.

Older technique like creating an `<img>` pixel in an `unload` event listener are notoriously unreliably (especially on mobile) and can negatively impact performance (by making pages ineligible for bfcache).

## How to implement

1. **Schedule the request:** As soon as relevant data is available, call `fetchLater()` with your data payload. This queues the data to be sent later.

2. **Update the payload as needed:** If the user generates more data or the state changes, abort the previously scheduled request and call `fetchLater()` again with the fully updated snapshot.

3. **Let the browser handle the rest:** When the user navigates away or closes the tab, the browser will reliably send the payload from your most recent `fetchLater()` call.

## Example code

This code measures the session duration of a user's visit to a page using `fetchLater()` to queue a new beacon every 10 seconds with the updated session duration.

```javascript
const ANALYTICS_ENDPOINT = '/path/to/analytics/endpoint';

const sessionData = {
  duration: 0,
  id: crypto.randomUUID(),
};

let fetchLaterController = null;

function queueBeacon() {
  // Abort any pending beacons before creating a new one.
  if (fetchLaterController) {
    fetchLaterController.abort();
  }
  fetchLaterController = new AbortController();

  // Update session duration to the current page time.
  sessionData.duration = performance.now();

  // Schedule a fetch for the data payload to be sent later.
  // IMPORTANT: wrap the call in a try/catch to handle quota errors.
  try {
    fetchLater(ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(sessionData),
      signal: fetchLaterController.signal,
    });
  } catch (error) {
    // Handle errors as needed.
  }
}

// Update the session data and queue a new beacon every 10 seconds.
setInterval(queueBeacon, 10000);
```

## Best Practices

- **DO** use `fetchLater()` to send data to a server in any situation where a response is not necessary, and it's not critical that the data is sent immediately.
- **DO** use an `AbortController` to cancel the pending fetch in cases where the data may need to be updated before the user leaves the page
- **DO** minimum the payload size to avoid exceeding the quota (currently roughly 64KB per origin).
- **DO** wrap calls to `fetchLater()` in a `try/catch` to handle quota errors.
- **DO** feature detect the presence of `fetchLater()` on `globalThis` and implement a fallback strategy for browsers that don't support the API.
- **DO NOT** use a `ReadableStream` object for the request body, as that will error.

## Browser support and fallback strategies

fetchLater has limited availability.
Supported by: Chrome 135 (Apr 2025) and Edge 135 (Apr 2025).
Unsupported in: Firefox and Safari.

A fallback strategy is required if `fetchLater()` doesn't meet your Baseline target. However, given the improved reliability and performance benefits of this API, `fetchLater()` should be used if the browser supports it.

The recommended fallback strategy is to use the polyfill below, which internally handles unsupporting browsers using `fetch()` with `keepalive` or `navigator.sendBeacon()`. Your own code MUST call `fetchLater()` directly — never call `fetch()`, `sendBeacon()`, or other beacon APIs yourself.

### `fetchLater()` polyfill

Use the following minimal `fetchLater()` polyfill, which implements the API as closely as possible in unsupporting browsers.

The only notable behavior difference with this polyfill is that it uses `visibilitychange` to detect when the user leaves, rather than relying on the browser's native unload handling. This is an internal implementation detail — your code does not need to listen for `visibilitychange` or any other page lifecycle events. Just call `fetchLater()` and the polyfill handles delivery.

```js
globalThis.fetchLater ??= function fetchLater(url, init = {}) {
  let timeoutHandle;
  let activated = false;

  function sendNow() {
    if (!(init.signal && init.signal.aborted)) {
      // Use fetch keepalive if the browser supports it or if custom fetch
      // parameters are specified (e.g. custom headers or methods).
      // Otherwise fall back to `navigator.sendBeacon()`.
      if (
        'keepalive' in Request.prototype ||
        init.method !== 'POST' ||
        init.headers
      ) {
        fetch(url, Object.assign({}, init, {keepalive: true}));
        activated = true;
      } else {
        activated = navigator.sendBeacon(url, init.body);
      }
    }
    destroy();
  }

  function destroy() {
    document.removeEventListener('visibilitychange', sendNow);
    clearTimeout(timeoutHandle);
  }

  if (document.visibilityState === 'hidden') {
    // If the beacon was created while the page is already hidden, send data
    // ASAP but wait until the next microtask to allow all sync code to run.
    queueMicrotask(sendNow);
  } else {
    document.addEventListener('visibilitychange', sendNow);

    if (typeof init.activateAfter === 'number' && init.activateAfter >= 0) {
      timeoutHandle = setTimeout(sendNow, init.activateAfter);
    }
  }

  if (init.signal) {
    init.signal.addEventListener('abort', destroy);
  }

  return {
    get activated() {
      return activated;
    },
  };
};
```
