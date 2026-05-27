# Identify heavy-running JavaScript

Heavy-running JavaScript can have a detrimental effect on both page load performance and interactivity. Modern web applications are more heavily reliant on JavaScript than ever before, from multiple sources. These include the application code itself (and the framework code it relies on), as well as third-party scripts that add functionality like chat widgets and video players. Behind-the-scenes analytics and marketing scripts are also common contributors that are all too easy to forget.

Identifying root causes of an unresponsive web page can be tricky with certain expertise required to run web performance tracing or profiling and how to interpret the results. Additionally field data is often very different to lab data, which only replicates a small subset of real user scenarios. This can make it difficult to identify the root causes of poor performance, especially for interactions.

The Long Animation Frames API is a lightweight API that can be used to identify heavy-running JavaScript in the field. A heavy-running script can be either a single long-running script, or a script that runs multiple times during the page lifecycle.

## How to implement

Long animation frames are monitored using the `PerformanceObserver` interface. It emits a `long-animation-frame` entry when an animation frame takes longer than 50ms to render. The entry contains information about the long animation frame, including the duration of the frame and the scripts that were executed during the frame.

The `long-animation-frame` entry contains a `scripts` property which is an array of `PerformanceScript` objects. Each `PerformanceScript` object contains information about the script that was executed during the long animation frame, including the `sourceURL` and `duration` of the script.

### Example of identifying the longest running scripts that contribute to long animation frames

```javascript
// Accumulate all script entries across the page lifecycle so no
// data is lost between observer callbacks.
const allScripts = [];

const observer = new PerformanceObserver(list => {
  // Collect all script entries across frames to find the biggest offenders.
  allScripts.push(...list.getEntries().flatMap(entry => entry.scripts));

  // Group by sourceURL so you can identify which scripts contribute
  // the most total time, even if each individual invocation is short.
  const scriptSource = [...new Set(allScripts.map(script => script.sourceURL))];
  const scriptsBySource = scriptSource.map(sourceURL => ([sourceURL,
      allScripts.filter(script => script.sourceURL === sourceURL)
  ]));
  const processedScripts = scriptsBySource.map(([sourceURL, scripts]) => ({
    sourceURL,
    count: scripts.length,
    totalDuration: scripts.reduce((subtotal, script) => subtotal + script.duration, 0)
  }));

  // Only include scripts above a certain threshold to reduce noise.
  const heavyScripts = processedScripts.filter(script => {
    return script.totalDuration > 100;
  });

  // Sort by total duration so the worst offenders appear first,
  // making it easier to prioritize optimization efforts.
  heavyScripts.sort((a, b) => b.totalDuration - a.totalDuration);

  // Log to the console for local debugging. In production, replace
  // this with a call to send the data to your analytics service.
  console.table(heavyScripts);
});

// Use buffered: true to capture any long frames that occurred before
// this observer was registered.
observer.observe({type: 'long-animation-frame', buffered: true});
```

## Best Practices

- **DO** prefer the Long Animation Frames API over alternatives like the JS Self-Profiling API, which carries higher runtime overhead.
- **DO** summarize the key information as the Long Animation Frames API contains a lot of detail.
- **DO** send the required information to an analytics service in production.

## Browser support and fallback strategies

Long animation frames has limited availability.
Supported by: Chrome 123 (Mar 2024) and Edge 123 (Mar 2024).
Unsupported in: Firefox and Safari..

The Long Animation Frames API is ignored by browsers that do not support it, so it can be safely used without fallbacks. In most cases the performance opportunities it identifies will apply to other browsers as well.
