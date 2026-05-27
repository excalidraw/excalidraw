When building complex web applications, tasks have different levels of urgency. Completing tasks for the current view is more important than sending analytics or prefetching assets. The Prioritized Task Scheduling API allows you to schedule work with specific priorities, ensuring the browser remains responsive to user input.

### Scheduling tasks by priority

Use `scheduler.postTask()` to schedule tasks with one of three priorities:
- `user-blocking`: Tasks that block user interaction (e.g., input handling, critical rendering).
- `user-visible`: Tasks visible to the user but not blocking (default).
- `background`: Tasks that are not time-critical (e.g., analytics, prefetching).

```javascript
// Schedule a high-priority task that blocks user interaction
scheduler.postTask(() => {
  // DO: Handle critical updates that impact user interaction
  handleCriticalUpdate();
}, { priority: 'user-blocking' });

// Schedule a default priority task
scheduler.postTask(() => {
  // DO: Render non-critical content that is visible to the user
  renderSecondaryContent();
}); // Defaults to 'user-visible'

// Schedule a low-priority background task
scheduler.postTask(() => {
  // DO: Perform heavy background work that is not time-critical
  sendAnalytics();
}, { priority: 'background' });
```

### Fallback strategies

Scheduler API has limited availability.
Supported by: Chrome 129 (Sep 2024), Edge 129 (Sep 2024), and Firefox 142 (Aug 2025).
Unsupported in: Safari.

To support browsers that do not have the Prioritized Task Scheduling API, you must use a polyfill to maintain task prioritization.

```javascript
// Feature detect the scheduler API
if (!('scheduler' in window && 'postTask' in window.scheduler)) {
  // DO: Conditionally load the polyfill for browsers that need it
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/scheduler-polyfill';
  script.onload = () => {
    // Polyfill is loaded and ready to use
    runScheduledTasks();
  };
  document.head.appendChild(script);
} else {
  runScheduledTasks();
}

function runScheduledTasks() {
  // Now safe to use scheduler.postTask in all browsers
  scheduler.postTask(() => {
    console.log('Task with priority support');
  }, { priority: 'background' });
}
```
