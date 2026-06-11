# Stack Drill Down

## Overview

A stack drill-down is a hierarchical navigation pattern, common in mobile apps, where activating a link pushes a new full-screen view on top of the previous one. The view's content is application-defined — a settings sub-page, a thread inside a feed, a folder inside a file browser, a detail page inside a gallery, etc. The user returns by swiping the current view off-screen to the right or by tapping a back button. Browser history stays in sync so the OS-level Back gesture, deep links, and forward/back navigation all work coherently.

This guide implements the stack as:

- A horizontal CSS scroll-snap container where each view is exactly one snap stop. Drilling down appends a new view and smooth-scrolls to it; the swipe-back gesture is handled natively by the browser, giving momentum, velocity, and interruption tracking for free with no pointer-event JavaScript.
- A `scrollsnapchange` event listener on the stack that fires when the snap target changes. This is used as the single source of truth for "the active view changed" — so swipe, click, programmatic scroll, and `popstate` paths all converge in one callback that updates `inert`, restores focus, prunes views the user swiped past, and reconciles browser history.
- A `pushState` / `popstate` integration so every drill-down adds a history entry, the OS-level Back gesture works, and deep links open directly into the right view.
- An (optional) scroll-driven `view()` animation on each view that produces a parallax + dim + shadow effect tied directly to the swipe gesture, so the visible motion is driven by the user's finger, not a tween.

This approach is preferred over JavaScript-driven `transform` animations because the snap mechanism gives the user direct gestural control of the panel's position (their finger drives it, not a tween) and matches the interaction patterns users expect from native mobile apps.

## Implementation

### 1. Markup

The static HTML is just an empty stack container; views are built in JavaScript and appended as the user navigates.

```html
<div class="Stack">
  <!-- Intentionally empty. The initial view is appended by JavaScript
       at init time (step 8). -->
</div>
```

Each view is a `.Stack-view` direct child of `.Stack` (the snap target) with a `.Stack-viewContent` wrapper inside it (where view content lives, and where the parallax transform applies — see step 2). At any moment the stack has one view per active history entry, left-to-right in drill-down order. After the user has drilled in two levels from the root the rendered DOM looks like this:

```html
<div class="Stack">
  <!-- Root view. Has whatever content makes sense as the entry point
       of this section of the app. No back button — there is nothing
       behind the root in the stack. -->
  <div class="Stack-view" inert>
    <div class="Stack-viewContent">
      <!-- Root content; includes <a href> links that drill in. -->
    </div>
  </div>

  <!-- First-level drill-down view. The user got here by activating a
       link in the root view. -->
  <div class="Stack-view" inert>
    <div class="Stack-viewContent">
      <header>
        <!-- DO include a back button. The swipe gesture only works on
             touch — keyboard and pointer users need an explicit control. -->
        <button class="back" aria-label="Back"></button>
        <!-- Title / breadcrumb / etc. -->
      </header>
      <main>
        <!-- View content; may include further drill-down <a href> links. -->
      </main>
    </div>
  </div>

  <!-- Second-level drill-down view. Currently visible — no `inert`
       attribute. Same shape as the first-level view. -->
  <div class="Stack-view">
    <div class="Stack-viewContent">
      <header>
        <button class="back" aria-label="Back"></button>
        <!-- ... -->
      </header>
      <main><!-- ... --></main>
    </div>
  </div>
</div>
```

Notes:

- All views except the currently-visible one carry the `inert` attribute. This is applied/removed automatically by the `scrollsnapchange` handler in step 7 — do not set it from your view builders.
- Views the user swipes back past are removed from the DOM (also by step 7) so the stack never grows beyond `currentDepth + 1` children. They are rebuilt on demand from their cached URL paths if forward navigation returns to them.

### 2. Styles

#### The stack scroller

The stack is a horizontal grid where each child view is exactly the width of the container, with CSS scroll-snap enforcing one-view-per-snap. This is what gives the swipe-back gesture its native feel.

```css
.Stack {
  /* Use dvh so the height tracks the dynamic viewport on mobile, where
     the address bar can show/hide. svh would clip during the address bar
     animation; vh leaks under it. */
  height: 100dvh;

  /* Lay views out left-to-right, each one full-width, so horizontal
     scrolling moves between them one at a time. */
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 100%;
  grid-template-rows: 100%;
  overflow-x: auto;

  /* `mandatory` guarantees the stack always settles fully on a view —
     never half-way between two. */
  scroll-snap-type: x mandatory;
  /* Prevent the swipe-back gesture from chaining into the browser's
     own history-back gesture (iOS, some Android) or the page's vertical
     scroll. The user is navigating the stack, not the page. */
  overscroll-behavior-x: none;
}

/* Hide the visual scrollbar — the snap and the parallax are the
   affordances; a horizontal scrollbar would look out of place. */
.Stack::-webkit-scrollbar {
  display: none;
}

/* MANDATORY: Opt into smooth programmatic scrolling via CSS, gated on
   prefers-reduced-motion. JS code calls scrollTo/scrollBy with
   behavior: 'auto' which defers to this rule, so the OS-level reduced-
   motion preference automatically downgrades to instant scrolling
   without any per-call JS branching. */
@media (prefers-reduced-motion: no-preference) {
  .Stack {
    scroll-behavior: smooth;
  }
}

.Stack-view {
  scroll-snap-align: start;
  /* `always` prevents the user from blowing through more than one view
     per gesture, so depth changes always happen one step at a time. */
  scroll-snap-stop: always;
}

/* MANDATORY: A separate inner element is required for the parallax
   transform below. Applying transforms directly to the snap target
   (.Stack-view) would feed back into the scroll container's snap
   geometry and the scroller would jump mid-gesture. */
.Stack-viewContent {
  width: 100%;
  height: 100%;
  background-color: #fff;
  /* Each view scrolls its own content vertically, independent of the
     stack's horizontal scroll. */
  overflow-y: auto;
}
```

#### The "stack" effect (parallax / dim / shadow)

A scroll-driven `view(inline)` animation tracks each view's progress through the stack scroller and applies a parallax + dim to the exiting view, plus a shadow on incoming drill-down views so they read as "cards" stacking over the previous view.

```css
/* MANDATORY: Wrap the animation block in @supports. Browsers without
   scroll-driven animations still parse the @keyframes and would
   apply the `to` state as a static style, leaving every view
   permanently transformed. The @supports gate confines the animation
   to browsers where it actually animates. */
@supports (animation-timeline: view()) {
  .Stack-viewContent {
    /* view(inline) tracks this element's progress through its nearest
       scrollable ancestor on the inline (x) axis. */
    animation: parallax linear both;
    animation-timeline: view(inline);
    /* Only animate the EXIT phase — when this view is being covered
       by a deeper one. During its own entry the view stays at rest,
       so the fresh content is fully bright and in position throughout. */
    animation-range: exit 0% exit 100%;
  }

  /* Drill-down views (everything except the root) also get a shadow on
     their left edge during the transition so they feel like cards
     stacking over the previous view. */
  .Stack-view:not(:first-child) .Stack-viewContent {
    animation: parallax linear both, shadow-fade linear both;
    animation-timeline: view(inline), view(inline);
    /* parallax: only exit (the view sliding back as a deeper one comes in).
       shadow-fade: entry through exit (visible the whole time the view is
       transitioning, not when it's at rest). */
    animation-range: exit 0% exit 100%, entry 0% exit 100%;
  }

  @keyframes parallax {
    /* translateX(75%) and brightness(0.8) are examples — adjust to taste. */
    to {
      transform: translateX(75%);
      filter: brightness(0.8);
    }
  }

  @keyframes shadow-fade {
    /* Shadow ramps in during entry, holds across the middle of the
       gesture, and ramps out during exit — so it's only visible while
       the view is mid-transition, not when at rest. */
    0%, 100% { box-shadow: 0 0 1.5rem #0000; }
    25%, 75% { box-shadow: 0 0 1.5rem #0004; }
  }
}
```

NOTE: This effect is popular in modern native stack applications and is a good starting point, but the exact visual effects can be customized to fit existing transition styles as needed.

### 3. Module state

The stack tracks four pieces of state in module scope:

```js
const stack = document.querySelector('.Stack');

// Reference to the root view DOM element. The Stack starts empty, so
// this is null until the root view is created — either at init (step 8,
// when the URL is '/') or later by synthesizeRootEntry() (when the user
// landed on a deep link and then navigates back). Held as a mutable
// reference because other code (the scrollsnapchange handler, init, etc.)
// uses identity comparisons against it.
let rootView = null;

// Tracks which element to restore focus to when the user swipes back
// into a previous view. Keyed by the view element itself so entries
// are garbage-collected automatically when the view is pruned.
const returnFocus = new WeakMap();

// Maps history depth -> {urlPath, view}. We MUST maintain this map
// ourselves because the History API does not expose state for entries
// other than the current one — so when a view is pruned on swipe-back,
// we still need to remember which URL it represented in case the user
// later forward-navigates back into it.
const entriesByDepth = new Map();

// Tracked manually because history.state on a popstate event tells us
// the destination depth but not where we came from. We need both to
// compute the direction (back vs forward) and the distance.
let currentDepth = 0;
```

Plus three application-specific helpers — the only places where your app's routing and view rendering plug in:

```js
// Resolve a URL path to the data your app needs to render the
// corresponding drill-down view, or return null for paths this section
// of the app does not handle (the root path '/', external links,
// unknown routes). resolveUrl() is for drill-down routes only — the
// root view is rendered separately by createRootView() below.
function resolveUrl(urlPath) {
  // Replace with your routing logic. For example, match `/view/:id`
  // and look the id up in your app state.
}

// Build the root (home) view of the stack. Application-specific content;
// preserve the .Stack-view / .Stack-viewContent wrapper structure (the
// inner element is required for the parallax — see step 2) and DO NOT
// render a back button — the root view has nothing behind it in the
// stack.
function createRootView() {
  const view = document.createElement('div');
  view.className = 'Stack-view';
  view.innerHTML = `
    <div class="Stack-viewContent">
      <!-- Root content. Include <a href> elements pointing at URL paths
           that resolveUrl() accepts, to enable drill-down from here. -->
    </div>
  `;
  return view;
}

// Build a drill-down view DOM element from the resolved route data.
// Customize the inner content freely, but DO preserve the .Stack-view
// / .Stack-viewContent wrapper structure and DO include a back button
// (the swipe gesture only works on touch).
function createDrillDownView(routeData) {
  const view = document.createElement('div');
  view.className = 'Stack-view';
  view.innerHTML = `
    <div class="Stack-viewContent">
      <header>
        <button class="back" aria-label="Back"></button>
        <!-- Title, breadcrumb, or other view chrome derived from
             routeData. -->
      </header>
      <main>
        <!-- View body, also from routeData. Include further <a href>
             elements pointing at URL paths that resolveUrl() also
             accepts, to enable additional drill-downs from this view. -->
      </main>
    </div>
  `;
  return view;
}

function getCurrentUrlPath() {
  return location.pathname;
}
```

### 4. Drill down

A drill-down does four things in this order: push a history entry, build the new view, append it, smooth-scroll to it. The `scrollsnapchange` handler (step 7) picks up from there once the snap settles.

```js
function drillDown(urlPath) {
  const routeData = resolveUrl(urlPath);
  if (!routeData) return;

  const newDepth = currentDepth + 1;
  // Push BEFORE creating the view so the URL is correct if anything
  // observing history (analytics, etc.) reads it during view creation.
  history.pushState({depth: newDepth}, '', urlPath);

  // pushState truncates forward entries in real browser history;
  // mirror that truncation in our depth map so we don't hold references
  // to views the user can no longer reach.
  for (const d of entriesByDepth.keys()) {
    if (d >= newDepth) entriesByDepth.delete(d);
  }
  currentDepth = newDepth;

  const newView = createDrillDownView(routeData);
  stack.appendChild(newView);
  entriesByDepth.set(newDepth, {urlPath, view: newView});

  // Scroll one viewport-width to the right. behavior: 'auto' defers to
  // the CSS `scroll-behavior` set in step 2, which is smooth unless
  // prefers-reduced-motion is set. The snap container locks onto the
  // new view; the scrollsnapchange listener (step 7) fires when the
  // snap settles.
  stack.scrollBy({left: stack.clientWidth, behavior: 'auto'});
}
```

### 5. Click and back-button handling

Intercept link clicks inside the stack and convert them to drill-downs. Preserve modifier-key behavior so cmd/middle-click still opens the link in a new tab.

```js
stack.addEventListener('click', (e) => {
  // Back button: defer to goBack() (defined below), which handles both
  // the normal in-app case and the deep-link case.
  if (e.target.closest('.back')) {
    goBack();
    return;
  }

  // Drill-down link.
  const link = e.target.closest('a');
  if (!link || !stack.contains(link)) return;
  // Let the browser handle modified clicks so users can open links
  // in new tabs / windows. e.button !== 0 filters out middle-clicks.
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;

  const urlPath = new URL(link.href).pathname;
  const parentView = link.closest('.Stack-view');
  // If the URL isn't handled by this section of the app (resolveUrl
  // returns null), fall through so the browser navigates normally.
  if (!resolveUrl(urlPath) || !parentView) return;

  e.preventDefault();
  // Record which link the user activated so focus can be restored to
  // it when they swipe (or click) back into this view.
  returnFocus.set(parentView, link);
  drillDown(urlPath);
});

// Going back is usually just history.back(), but there's an important
// edge case: when the user lands directly on a deep-linked URL, there
// is no in-app history entry behind it. Calling history.back() in that
// situation would take them out of the app entirely. MANDATORY: detect
// this case and synthesize a root entry instead, so an in-app Back from
// a deep link lands on the root view and the platform Back from there
// returns the user to where they came from.
function goBack() {
  const atDeepLinkRoot = currentDepth === 0
    && entriesByDepth.get(0)?.view !== rootView;
  if (atDeepLinkRoot) {
    synthesizeRootEntry();
  } else {
    // history.back() fires popstate, which routes through
    // updateFromHistoryState (step 6) and scrolls the stack — the
    // same path a swipe-back converges on.
    history.back();
  }
}

function synthesizeRootEntry() {
  // Push a new history entry pointing at the root URL. This becomes the
  // entry the user "came from"; the original deep-linked entry is now
  // behind us, so platform Back from the root view will return there.
  const newDepth = currentDepth + 1;
  history.pushState({depth: newDepth}, '', '/');

  // Create the root view if it doesn't exist yet (we landed on a deep
  // link and never needed it before now), and insert it at the LEFT end
  // of the stack. Adjust scrollLeft by one viewport width so the user's
  // view doesn't visually jump — they should still be looking at the
  // deep-linked view until the scroll animation below runs.
  if (!rootView) {
    rootView = createRootView();
    stack.prepend(rootView);
    stack.scrollLeft += stack.clientWidth;
  }
  entriesByDepth.set(newDepth, {urlPath: '/', view: rootView});

  // Now scroll to the new entry (the root view). updateFromHistoryState
  // smooth-scrolls one step left, the parallax plays, and
  // scrollsnapchange fires when the root view settles.
  updateFromHistoryState(history.state);
}
```

### 6. Sync from history (popstate)

`popstate` fires when the user uses the browser/OS back or forward button, or when JavaScript calls `history.back()` / `.go()`. This handler is the only path that scrolls the stack in response to a history change.

```js
window.addEventListener('popstate', (event) => {
  updateFromHistoryState(event.state);
});

function updateFromHistoryState(state, behaviorOverride) {
  const newDepth = state?.depth ?? 0;
  const urlPath = getCurrentUrlPath();

  // Ensure entriesByDepth has an entry for the destination depth.
  // If the URL changed (e.g. forward-nav into a previously-pruned
  // view), clear the cached view reference so the loop below rebuilds.
  const entry = entriesByDepth.get(newDepth) ?? {view: null};
  if (entry.urlPath !== urlPath) {
    entry.urlPath = urlPath;
    entry.view = urlPath === '/' ? rootView : null;
  }
  entriesByDepth.set(newDepth, entry);

  // Rebuild any views between root and the destination that were
  // pruned earlier (when the user swiped back past them). Without
  // this, forward-navigating to a previously-pruned view would have
  // no element to scroll to.
  for (let d = 0; d <= newDepth; d++) {
    const e = entriesByDepth.get(d);
    if (!e || e.view) continue;
    const routeData = resolveUrl(e.urlPath);
    if (!routeData) continue;
    const rebuilt = createDrillDownView(routeData);
    stack.appendChild(rebuilt);
    e.view = rebuilt;
  }

  currentDepth = newDepth;

  const targetView = entriesByDepth.get(newDepth)?.view;
  if (!targetView) return;

  // Compare destination index against current scroll position so we
  // can bail if they're already aligned. This is reached when the
  // scrollsnapchange handler below calls history.go() to sync history
  // after a swipe-back that already completed visually — there's
  // nothing more to scroll.
  const toIdx = [...stack.children].indexOf(targetView);
  const fromIdx = Math.round(stack.scrollLeft / stack.clientWidth);
  if (fromIdx === toIdx) return;

  // Pick a scroll behavior:
  //   - multi-step jumps (e.g. history.go(-3)): 'instant' to skip
  //     intermediate snap points — otherwise smooth-scrolling would
  //     fire scrollsnapchange for each one and do N rounds of
  //     state-transition work for no reason.
  //   - rightward (forward) single-step: 'instant'. Browser-forward is
  //     rare on the web and is often spurious (e.g. iOS Safari treats
  //     edge swipes as forward navigation, even with overscroll-behavior
  //     set). An instant swap reads as "snap" rather than a misleading
  //     drilldown animation the user didn't ask for. The user-initiated
  //     drill-down path (drillDown, step 4) is unaffected — it calls
  //     scrollBy directly and never reaches this code.
  //   - leftward (back) single-step: 'auto' so the CSS `scroll-behavior`
  //     (smooth unless prefers-reduced-motion is set — see step 2)
  //     applies. Back is the common, expected case and benefits from
  //     the animation.
  // NOTE: "forward" here means spatial direction (toIdx > fromIdx),
  // NOT depth direction. synthesizeRootEntry (step 5) pushes a new
  // depth but scrolls LEFT to the root view, which correctly reads as
  // back-style (smooth).
  const forward = toIdx > fromIdx;
  const multiStep = Math.abs(toIdx - fromIdx) > 1;
  const behavior = behaviorOverride ?? (forward || multiStep ? 'instant' : 'auto');
  stack.scrollTo({left: toIdx * stack.clientWidth, behavior});
}
```

### 7. `scrollsnapchange`: the single source of truth

After every snap commit — whether triggered by a swipe, a click, or a programmatic scroll — the browser fires a `scrollsnapchange` event on the scroll container, with the newly snapped element exposed as `event.snapTargetInline` (for horizontal snapping). Putting all state transitions inside this one handler is what keeps the swipe path, the click path, and the `popstate` path coherent.

The handler is extracted into a standalone `onActiveViewChanged` function so the fallback (see "Fallback strategies" below) can reuse it without duplicating the logic.

```js
function onActiveViewChanged(currentView) {
  // Walk the stack in DOM order to update each view's role:
  //  - Views at or before currentView stay in the DOM but get
  //    `inert` (except currentView) so focus, pointer events, and
  //    AT navigation cannot leak into views hidden behind the
  //    parallax.
  //  - Views after currentView are unreachable (the user swiped
  //    back past them) so we drop them from the DOM to free memory.
  //    Their urlPath stays in entriesByDepth so a later forward
  //    navigation can rebuild the view from scratch.
  let seenCurrent = false;
  for (const view of [...stack.children]) {
    if (seenCurrent) {
      for (const e of entriesByDepth.values()) {
        if (e.view === view) e.view = null;
      }
      view.remove();
    } else {
      // MANDATORY: inert non-current views. Without this, tabbing
      // and screen-reader navigation can reach content hidden behind
      // the parallax — a severe accessibility failure that's
      // invisible to sighted users.
      view.toggleAttribute('inert', view !== currentView);
      if (view === currentView) seenCurrent = true;
    }
  }

  // If the visible view's depth doesn't match `currentDepth`, the
  // user got here by swiping (not clicking) — sync history so the
  // browser back/forward buttons stay coherent with what's on screen.
  let currentViewDepth;
  for (const [d, e] of entriesByDepth) {
    if (e.view === currentView) currentViewDepth = d;
  }
  if (currentViewDepth !== undefined && currentViewDepth !== currentDepth) {
    // history.go fires popstate, which re-enters updateFromHistoryState.
    // That call's fromIdx === toIdx check bails out without scrolling.
    history.go(currentViewDepth - currentDepth);
  }

  // Restore focus on the now-active view:
  //  - If we recorded which link the user activated to drill out
  //    of this view, return focus there so a swipe-back lands them
  //    exactly where they left off.
  //  - Otherwise (a freshly-pushed drill-down view), move focus to
  //    the back button so keyboard users have an obvious next action.
  //  - preventScroll is REQUIRED: without it, .focus() scrolls the
  //    snap container to bring the focused element into view, which
  //    fights the snap and can land the user mid-snap.
  const stored = returnFocus.get(currentView);
  if (stored) {
    stored.focus({preventScroll: true});
    returnFocus.delete(currentView);
  } else if (currentView !== rootView) {
    currentView.querySelector('.back')?.focus({preventScroll: true});
  }
}

stack.addEventListener('scrollsnapchange', (event) => {
  // snapTargetInline is the element that was just snapped to on the
  // inline (horizontal) axis. For this stack — where each view is one
  // horizontal snap stop — that's the new active view.
  onActiveViewChanged(event.snapTargetInline);
});
```

### 8. Initialization (including deep links)

When the page loads, the URL may already point at a deep view (a shared link, a bookmark, a refresh on a deep page). Build whichever initial view matches the URL — root or deep-linked, but never both — append it to the empty stack, seed the depth-0 history entry, and run an initial scroll pass with `behavior: 'instant'` so the parallax doesn't animate on first paint.

```js
const initialUrlPath = getCurrentUrlPath();
const initialRouteData = resolveUrl(initialUrlPath);

// Build the initial view: a drill-down view if the URL maps to one,
// otherwise the root view. Whichever it is, that's the only view in
// the stack right now — the other will be created lazily by
// synthesizeRootEntry (step 5) or drillDown (step 4) if the user
// navigates to it.
let initialView;
if (initialRouteData) {
  initialView = createDrillDownView(initialRouteData);
} else {
  rootView = createRootView();
  initialView = rootView;
}
stack.appendChild(initialView);

entriesByDepth.set(0, {urlPath: initialUrlPath, view: initialView});
// replaceState attaches a `depth` to the entry the user landed on, so
// any subsequent pushState / popstate has a base depth to count from.
history.replaceState({depth: 0}, '');

updateFromHistoryState(history.state, 'instant');
```

### Best practices

- **DO** use the `scrollsnapchange` event (with an `IntersectionObserver` fallback — see "Fallback strategies") as the source of truth for "the active view changed", not scroll-event coordinates. Snap commit is the only event that fires consistently across swipe, click, programmatic scroll, and `popstate` paths.
- **DO** apply transforms to a child of the snap target, never to the snap target itself. A transform on the snap target feeds back into the scroll container's snap geometry and the scroller will glitch mid-gesture.
- **DO** apply `inert` to every view except the currently visible one. Without this, focus and screen-reader navigation leak into views hidden behind the parallax — invisible to sighted users but a severe accessibility failure.
- **DO** push a history entry on every drill-down and handle `popstate` so the OS-level Back gesture and the browser back/forward buttons work. This is what makes the pattern feel like a native app.
- **DO** reconcile history from the active-view-changed handler when a swipe-back lands on a view whose depth doesn't match `currentDepth`. Without this, a subsequent OS Back returns the user somewhere unexpected because the browser's history cursor is out of sync with what's on screen.
- **DO** prune views the user swiped past from the DOM. A long drill-down session can otherwise accumulate dozens of detached subtrees. The cached URL path in `entriesByDepth` is enough to rebuild any view if forward navigation returns to it.
- **DO** call `.focus({preventScroll: true})` when restoring focus inside the stack. The default `preventScroll: false` makes the browser scroll the focus target into view, which fights the snap container and can land the user mid-snap.
- **DO** preserve cmd/ctrl/middle-click on internal links so URLs remain shareable and openable in a new tab.
- **DO** use `behavior: 'instant'` for multi-step history jumps AND for spatial-forward popstate transitions (`toIdx > fromIdx`). Multi-step jumps would otherwise fire `scrollsnapchange` at every intermediate snap and do N rounds of inert/focus/history work. Forward popstates are often spurious — iOS Safari treats edge swipes as browser forward even with `overscroll-behavior-x: none` set, and an instant swap is much less misleading than animating a "drilldown" the user didn't initiate. The user-initiated drill-down path (`drillDown`) is unaffected because it scrolls directly, not via `popstate`.
- **DO** respect `prefers-reduced-motion`: declare `scroll-behavior: smooth` only inside `@media (prefers-reduced-motion: no-preference)` and call `scrollTo` / `scrollBy` with `behavior: 'auto'` (not `'smooth'`) so the OS-level preference takes effect without per-call JS branching. Hard-coding `behavior: 'smooth'` bypasses the user's setting.
- **DO** render real `<a href>` elements as drill-down triggers, not `<button onclick>` or `<div>`. Real anchors get URL preview on hover, shareability, middle-click, screen-reader role, and SEO for free.
- **DO** include an explicit back button in every drill-down view. The swipe gesture only works on touch — keyboard, pointer, and desktop users need a visible affordance.
- **DO NOT** call `history.pushState` from the `popstate` handler — that pushes *new* entries while the user is trying to go back and breaks the browser back button.
- **DO NOT** drive the parallax with a `scroll` event listener when scroll-driven animations are available. The CSS path runs on the compositor; a JS scroll listener runs on the main thread and will visibly drop frames during the gesture.
- **DO NOT** mutate views you removed from the DOM after a swipe-back. Treat `entriesByDepth` as the canonical record: a pruned entry has `view: null` and is rebuilt on demand in `updateFromHistoryState`.

### Fallback strategies

Most of the features used in this guide are Baseline Widely available, and do not require any fallback. The only features not widely available that may require fallbacks are scroll-snap-events and scroll-driven-animations, both of which have robust fallback or progressive enhancement stories, and are safe to use for this use case:

#### Scroll snap events

Scroll snap events has limited availability.
Supported by: Chrome 129 (Sep 2024) and Edge 129 (Sep 2024).
Unsupported in: Firefox and Safari.

The `scrollsnapchange` event is the cleanest way to detect "the active view changed" — one listener on the stack, fired exactly once per snap commit. In browsers without it, the same effect can be polyfilled with an `IntersectionObserver` watching each view for full visibility inside the stack. The fallback dispatches into the same `onActiveViewChanged` function the primary path uses, so all the state-transition logic stays in one place.

```js
// MANDATORY when supporting browsers that haven't shipped scroll-snap-events
// yet. Check `HTMLElement.prototype` (not `window` or `document`) — the
// event handler IDL attribute is added to the prototype when the feature
// is supported, regardless of whether any element has the handler set.
if (!('onscrollsnapchange' in HTMLElement.prototype)) {
  const viewObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      // threshold:1 only fires for fully-visible entries, but the
      // observer also emits a "leaving" entry per view that drops below
      // ratio 1. Filter to the entering side, which is the snap-commit
      // moment we're trying to detect.
      if (entry.intersectionRatio === 1) {
        onActiveViewChanged(entry.target);
      }
    }
  }, {root: stack, threshold: 1});

  // Auto-observe every .Stack-view as it's added to the stack, and stop
  // observing as it's removed. Using a MutationObserver lets the primary
  // code (drillDown, updateFromHistoryState, synthesizeRootEntry, init)
  // stay free of fallback wiring.
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.classList?.contains('Stack-view')) viewObserver.observe(node);
      }
      for (const node of m.removedNodes) {
        if (node.classList?.contains('Stack-view')) viewObserver.unobserve(node);
      }
    }
  }).observe(stack, {childList: true});

  // Catch up to any views already in the stack at the time this code
  // runs (typically the initial view appended in step 8).
  for (const view of stack.children) viewObserver.observe(view);
}
```

#### Scroll-driven animations

Scroll-driven animations has limited availability.
Supported by: Chrome 115 (Jul 2023), Edge 115 (Jul 2023), and Safari 26 (Sep 2025).
Unsupported in: Firefox.

The scroll-driven parallax / dim / shadow effect is a progressive enhancement on top of the navigation core. The CSS `@supports (animation-timeline: view())` gate (shown in step 2) confines the animation to supporting browsers; everywhere else the views simply cut between snap stops with no transition. The component is fully functional without the parallax — snap, history sync, focus management, and `inert` all still work.

If a parallax fallback is required for older baseline targets, attach a `scroll` listener to the stack and write a CSS custom property describing each view's progress through the scrollport, then drive `transform` and `filter` from that property:

```js
if (!CSS.supports('animation-timeline: view()')) {
  stack.addEventListener('scroll', () => {
    const viewWidth = stack.clientWidth;
    for (const view of stack.children) {
      // Progress: 0 when this view is centered, 1 when it has fully
      // exited to the left. Matches the @keyframes mapping above.
      const offsetLeft = view.offsetLeft - stack.scrollLeft;
      const progress = Math.min(1, Math.max(0, -offsetLeft / viewWidth));
      const content = view.querySelector('.Stack-viewContent');
      content.style.transform = `translateX(${progress * 75}%)`;
      content.style.filter = `brightness(${1 - progress * 0.2})`;
    }
  });
}
```
