# Identify causes of poor INP

Poor responsiveness to interactions leads to a poor impression of a page being slow or even completely broken. Interaction to Next Paint (INP) is a metric based on the Event Timing API. It measures the worst interaction (minus some outliers) as a measure of the page's responsiveness.

Identifying root causes of an unresponsive web page can be tricky especially as it depends on user interactions and environmental conditions such as device capabilities and network conditions. This makes it even more difficult to diagnose compared to a more repeatable and predictable scenario like page load. Lab data only replicates a small subset of real user scenarios so measuring the causes of slow INP in the field is essential.

The Event Timing API allows for splitting the INP duration into three subparts: Input Delay (processing that is already happing when the interaction happens), Processing Duration (delays due as a direct result of the interaction), and Presentation Delay (delays that are due to rendering the next frame after the interaction). This helps identify if the issue is in other code, the interaction JavaScript code, or browser processing rendering updates respectively rather than jumping straight to the interaction code.

It is possible to gather further insights for JavaScript code delaying an interaction. A full performance trace using the JS Self-Profiling API is a heavyweight solution that is liable to cause performance problems. The Long Animation Frames API is a lightweight API that can be used to identify slow running JavaScript in the field for INP interactions.

## How to implement

Calculating INP from the raw Event Timing API is complicated and has several nuances. You are advised to use a RUM tool or library to gather this data.

`web-vitals` is an open-source library from Google that calculates the Core Web Vitals including INP, and also includes subparts and long animation frame data for the INP interaction.

## Get attributions for INP interactions using web-vitals library

The `web-vitals` library is a tiny library used to measure Core Web Vitals and other performance metrics. The `onINP()` function can be used to identify the slowest interaction and includes information about the INP subparts and scripts that were executed during the interaction using the Long Animation Frames API.

```javascript
// Use the attribution build to get Long Animation Frame data
// alongside the INP metric value.
import { onINP } from 'web-vitals/attribution';

onINP((metric) => {
  // Beacon script attribution for the longest script during the INP
  // interaction, so you can identify the root cause in production.
  navigator.sendBeacon(
    '/analytics',
    JSON.stringify({
      name: 'INP',
      value: metric.value,
      // These fields give the INP subparts:
      inputDelay: metric.attribution.inputDelay,
      presentationDelay: metric.attribution.presentationDelay,
      processingDuration: metric.attribution.processingDuration,
      interactionTarget: metric.attribution.interactionTarget,
      // These fields identify which script function was responsible
      // for the longest processing during the INP interaction.
      invokerType: metric.attribution.longestScript.entry?.invokerType,
      sourceURL: metric.attribution.longestScript.entry?.sourceURL,
      sourceFunctionName: metric.attribution.longestScript.entry?.sourceFunctionName,
      sourceCharPosition: metric.attribution.longestScript.entry?.sourceCharPosition,
      // subpart indicates which phase (input delay, processing, or
      // presentation delay) the longest script overlapped with most.
      subpart: metric.attribution.longestScript.subpart,
      intersectingDuration: metric.attribution.longestScript.intersectingDuration
    })
  );
});
```

## Best Practices

- **DO** use INP subparts initially to identify whether the delay is already running JavaScript (input delay), the event handlers JavaScript for the interaction (processing duration), or the subsequent rendering (presentation delay).
- **DO** attempt to identify the biggest blocking JavaScript as additional detail, particularly for input delay, and processing duration.
- **DO** prefer the Long Animation Frames API for providing this further detail over alternatives like the JS Self-Profiling API, which carries higher runtime overhead.
- **DO** use the `web-vitals` library if no other RUM solution is in place. It can identify the INP interaction and includes information about the subparts and the scripts that were executed during the interaction (using the Long Animation Frames API).
- **DO** beacon back the required information to an analytics service rather than just log it locally.

## Browser support and fallback strategies

Baseline status for Event timing: Newly available. It's been Baseline since 2025-12-12.
Supported by: Chrome 76 (Jul 2019), Edge 79 (Jan 2020), Firefox 89 (Jun 2021), and Safari 26.2 (Dec 2025).

The Event Timing API is available in most modern browsers and is necessary to calculate INP and the INP subparts. For browsers that do not support this API INP cannot be measured.

Long animation frames has limited availability.
Supported by: Chrome 123 (Mar 2024) and Edge 123 (Mar 2024).
Unsupported in: Firefox and Safari.

The Long Animation Frames API provides optional, additional details. It can be safely used without fallbacks. In most cases the performance opportunities it identifies will apply to other browsers as well.
