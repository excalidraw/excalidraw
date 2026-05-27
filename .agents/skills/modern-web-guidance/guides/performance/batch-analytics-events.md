# Debounce and batch multiple analytics events

Most analytics and telemetry data is low priority and you can safely defer sending it until the user leaves the page. The exception to this is if you need to deliver real-time updates, in which case timeliness matters.

The optimal way to provide real-time analytics updates, while still minimizing beacons, is to use `fetchLater()` with the `activateAfter` configuration option. This allows you to effectively debounce and batch all analytics events that occur within a given time window into a single beacon, that is reliably sent even if the user leaves the page before the timeout expires.

## How to implement

1. **Schedule the request:** As soon as any relevant analytics data is available, call `fetchLater()` with your data payload and pass an `activateAfter` value. This queues the data to be sent after that amount of time passes, or if the user leaves the page beforehand.

2. **Batch multiple events together:** If a new analytics event occurs before the `activateAfter` timeout expires, abort the previously scheduled request and call `fetchLater()` again (with the same `activateAfter` value) with the full event queue in a single payload.

3. **Reset the event queue when the timeout expires:** If a new analytics event occurs after the scheduled beacon has successfully sent (i.e. the `fetchLater()` result's `activated` value is `true`), reset the event queue.

3. **Let the browser handle the rest:** If the user navigates away or closes the tab before the `activateAfter` timeout expires, the browser will still reliably send the payload from your most recent `fetchLater()` call.

## Example code

This code tracks all `load` and `click` events on a page, and batches together all events that occur within a 10-second timeout.

```javascript
// Replace with your analytics endpoint.
const ANALYTICS_ENDPOINT = '/path/to/analytics/endpoint';

// Replace with a time window of your choice. All analytics events that
// occur within this time window will be batched together.
const BATCH_WINDOW = 10 * 1000;

// The maximum number of events to batch. Pick a number that is unlikely
// to overflow the fetchLater() quota for the page.
const MAX_QUEUE_SIZE = 100;

const eventQueue = [];
let fetchLaterResult;
let fetchLaterController;

function trackEvent(eventData) {
  // If the previously queued beacon has already been sent, or if the
  // max queue size has been met, reset the queue.
  if (fetchLaterResult?.activated || eventQueue.length > MAX_QUEUE_SIZE) {
    fetchLaterController = null;
    fetchLaterResult = null;
    eventQueue.length = 0;
  }

  eventQueue.push(eventData);

  // Abort any pending beacons before creating a new one.
  if (fetchLaterController) {
    fetchLaterController.abort();
  }
  fetchLaterController = new AbortController();

  // Schedule a fetch for the events to be sent when the batch window expires.
  // IMPORTANT: wrap the call in a try/catch to handle quota errors.
  try {
    fetchLaterResult = fetchLater(ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(eventQueue),
      signal: fetchLaterController.signal,
      activateAfter: BATCH_WINDOW,
    });
  } catch (error) {
    // Handle errors as needed.
  }
}

// Track page loads.
window.addEventListener('load', () => {
  trackEvent({type: 'page_load'});
});

// Track click events.
window.addEventListener('click', (event) => {
  trackEvent({type: 'click', target: serializeElement(event.target)});
});
```

## Best Practices

- **DO** use `fetchLater()` with the `activateAfter` option set to batch multiple analytics events that occur within close proximity of each other.
- **DO** use an `AbortController` to cancel the pending fetch in cases where a new analytics event occurs.
- **DO** check to ensure you do not batch too many events together and exceed the `fetchLater()` quota (currently roughly 64KB per origin).
- **DO** wrap calls to `fetchLater()` in a `try/catch` to handle quota errors.
- **DO** feature detect the presence of `fetchLater()` on `globalThis` and implement a fallback strategy for browsers that don't support the API.
- **DO NOT** use a `ReadableStream` object for the request body, as that will error.

## Browser support and fallback strategies

fetchLater has limited availability.
Supported by: Chrome 135 (Apr 2025) and Edge 135 (Apr 2025).
Unsupported in: Firefox and Safari.. Therefore, a fallback strategy is typically required.

However, given the improved reliability and performance benefits of this API, `fetchLater()` should be used if the browser supports it.

### `fetchLater()` polyfill

Use the following minimal `fetchLater()` polyfill, which implements the API as closely as possible in unsupporting browsers.

The only notable behavior difference with this polyfill is instead of sending the payload when the user leaves the page, it sends it whenever the page's `visibilityState` changes to "hidden", since this is the most reliable end-of-session signal that's widely available today.

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
