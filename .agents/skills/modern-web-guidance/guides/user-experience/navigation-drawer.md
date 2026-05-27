## Overview

A navigation drawer is a panel that slides in from the edge of the viewport over the page content, dimming everything behind it. It is opened from a trigger button and dismissed by swiping the panel off-screen, tapping the dimmed backdrop, or pressing Escape.

This guide implements the drawer as:

- A `popover="manual"` element promoted to the top layer so the panel and its `::backdrop` overlay every other element on the page, regardless of stacking context.
- A horizontally scrolling container with two CSS scroll-snap stops — one for "open", one for "closed" — so the swipe gesture is handled natively by the browser. This delivers momentum, velocity, and interruption tracking for free, with no JavaScript pointer-event code.
- A scroll-driven animation that ties the backdrop's opacity to the scroll position, so the dim fades in and out smoothly as the user drags the panel.
- An `IntersectionObserver` on the panel that detects when it has fully entered or fully left the viewport, and uses those moments to update focus, `aria-expanded`, and `inert`.

This approach is preferred over JavaScript-driven `transform` animations because the scroll mechanism gives the user direct control of the panel's position (their finger drives it, not a tween) and it much more closely matches the interaction patterns that users are accustomed to in native mobile apps.

## Implementation

### 1. Markup

The drawer is a single popover containing a horizontal scroller, which contains the visible "sheet". The trigger button lives in the page content.

```html
<!-- popover="manual" is REQUIRED. Do not use popover="auto" or "hint". -->
<div class="Drawer" id="drawer" popover="manual">
  <div class="Drawer-scroller">
    <nav class="Drawer-sheet" tabindex="-1">
      <!-- tabindex="-1" makes the sheet programmatically focusable so we
           can move focus into it when the drawer opens, without adding it
           to the natural tab order. -->
      <ul>
        <li><a href="/page-1">Page 1</a></li>
        <li><a href="/page-2">Page 2</a></li>
        <!-- ... -->
      </ul>
    </nav>
  </div>
</div>

<main>
  <header>
    <!-- aria-controls links the trigger to the drawer; aria-expanded
         reflects the current state for assistive tech. -->
    <button id="drawer-open"
            aria-label="Menu"
            aria-expanded="false"
            aria-controls="drawer">
      <!-- MANDATORY: Inline decorative SVGs MUST define aria-hidden="true" -->
      <svg aria-hidden="true" viewBox="0 0 24 24">...</svg>
    </button>
  </header>
  <!-- Page content. -->
</main>
```

### 2. Styles

#### Reset the popover and fill the viewport

The popover must cover the whole viewport so its `::backdrop` dims the entire page and the swipe surface extends edge-to-edge. The default user-agent popover styles (centered, auto-sized, bordered) get in the way and must be reset.

```css
.Drawer {
  /* min() caps the sheet width on large screens but on a phone leaves
     a 20% peek of page content visible, which is the affordance that
     tells the user they can tap outside to dismiss. */
  --drawer-width: min(20em, 80dvw);

  /* Custom property driven by the scroll-driven animation below.
     0 = drawer fully closed (transparent backdrop).
     1 = drawer fully open (visible backdrop). */
  --drawer-backdrop: 0;

  /* Reset UA popover style that would constrain the element. */
  width: auto;
  height: auto;
  background: transparent;
  border: 0;
  overflow: visible;
}

/* Style the popover's ::backdrop to achive the overlay effect and
   provide visual affordances indicating that the rest of the page is inert */
.Drawer::backdrop {
  background: #000;
  /* Use calc() to limit the opacity range so the content beneath is visible */
  opacity: calc(var(--drawer-backdrop) / 2);
}
```

#### Build the swipe surface with scroll snap

The scroller is a horizontal grid wider than the viewport: column 1 holds the sheet (width `--drawer-width`), column 2 is an empty pseudo-element spacer the width of the viewport. Snapping between the two columns is what opens and closes the drawer.

```css
.Drawer-scroller {
  position: relative;
  display: grid;
  /* Sheet on the left, full-viewport spacer on the right. The user
     scrolls between the two snap stops to open and close. */
  grid-template-columns: var(--drawer-width) 100%;

  overflow-x: scroll;
  /* Stop the swipe from chaining into the page's vertical scroll
     when the user reaches either snap edge. */
  overscroll-behavior: none;
  scrollbar-width: none;
  /* `mandatory` guarantees the drawer always settles fully open or
     fully closed — never half-open after a partial swipe. */
  scroll-snap-type: x mandatory;
}

/* Enable smooth scrolling natively, but only if the user has not
   requested reduced motion. */
@media (prefers-reduced-motion: no-preference) {
  .Drawer-scroller {
    scroll-behavior: smooth;
  }
}

/* The empty spacer that creates the "closed" snap stop. */
.Drawer-scroller::after {
  content: '';
  scroll-snap-align: end;
  /* Open the popover already scrolled to this stop (drawer off-screen),
     so the JS only needs to scroll to the open position to
     animate it in. */
  scroll-initial-target: nearest;
}

.Drawer-sheet {
  display: grid;
  grid-template-rows: auto 1fr;
  /* Use `svh` (small viewport height) — not `vh` or `dvh` — so the
     sheet height does not jump when the iOS Safari address bar
     resizes mid-swipe. */
  height: 100svh;

  background: #333;
  color: #fff;
  overflow-y: auto;
  scroll-snap-align: start;
  scrollbar-width: none;
}
```

#### Tie the backdrop opacity to the scroll position

A scroll-driven animation maps `--drawer-backdrop` from 1 (open) to 0 (closed) across the scroller's range, so the backdrop fades in and out perfectly synced with the drag.

```css
/* MANDATORY: Wrap this entire block in @supports. Browsers that don't
   support animation-timeline still parse the @keyframes and would
   apply the animation's `0%` value (--drawer-backdrop: 1) at all
   times, leaving the backdrop permanently opaque. The @supports gate
   ensures the animation is only registered where it actually works. */
@supports (animation-timeline: scroll()) {
  .Drawer {
    /* timeline-scope lets .Drawer reference a scroll-timeline that
       is defined on its descendant (the scroller). Without this, the
       timeline name is not visible to the .Drawer element. */
    timeline-scope: --drawer-fade;
    animation: fade-drawer-backdrop linear both;
    animation-timeline: --drawer-fade;
  }

  .Drawer-scroller {
    /* The horizontal scroll position of this element drives the
       timeline named `--drawer-fade`. */
    scroll-timeline: --drawer-fade x;
  }

  /* @property is REQUIRED. Without registering --drawer-backdrop with
     a `<number>` syntax, the browser treats it as a string and cannot
     interpolate it — the backdrop would jump from 0 to 1 with no
     fade. */
  @property --drawer-backdrop {
    syntax: '<number>';
    inherits: true;
    initial-value: 0;
  }

  @keyframes fade-drawer-backdrop {
    /* Scroll position 0 = drawer fully open = backdrop visible. */
    0% { --drawer-backdrop: 1 }
    /* Scroll position 100% = drawer fully closed = backdrop hidden. */
    100% { --drawer-backdrop: 0 }
  }
}
```

### 3. Open and close the drawer

Opening is two steps: promote the popover to the top layer, then scroll the sheet into view. Closing is one step: scroll back to the spacer; an observer (step 4) hides the popover once the sheet is fully off-screen.

```js
const drawer = document.getElementById('drawer');
const openBtn = document.getElementById('drawer-open');
const scroller = drawer.querySelector('.Drawer-scroller');
const sheet = drawer.querySelector('.Drawer-sheet');

function openDrawer() {
  // Show the popover first so the element is in the top layer before
  // we trigger any scrolling. `scroll-initial-target` (set on the
  // ::after spacer) places the initial scroll position at the closed
  // stop, so the drawer enters the top layer already off-screen.
  drawer.showPopover();

  // Scroll the sheet into view. The `behavior: 'auto'` option defers
  // to the CSS `scroll-behavior` property, which will be smooth unless
  // the user prefers reduced motion. Snap takes over at the end and
  // locks the drawer fully open.
  scroller.scrollTo({left: 0, behavior: 'auto'});
}

function closeDrawer() {
  // Scroll back to the spacer. Do NOT call hidePopover() here —
  // doing so would remove the element from the top layer mid-animation
  // and the close animation would not be visible. The
  // IntersectionObserver in step 4 hides the popover once the sheet
  // has actually left the viewport.
  scroller.scrollTo({left: scroller.offsetWidth, behavior: 'auto'});
}
```

### 4. Detect open and closed state

Use an `IntersectionObserver` on the sheet — not the scroll position — as the source of truth for the drawer's state. The observer fires regardless of how the sheet moved (user swipe, programmatic scroll, snap settle), so all dismissal paths converge in the same callback.

```js
function onDrawerOpened() {
  // Mark the rest of the page inert so keyboard and screen-reader
  // users cannot tab into content hidden behind the drawer.
  document.querySelector('main').inert = true;
  openBtn.setAttribute('aria-expanded', 'true');
  // Move focus into the drawer for keyboard users.
  sheet.focus();
}

function onDrawerClosed() {
  // Hide the popover only after the close animation completes,
  // so the slide-out is visible to the user.
  drawer.hidePopover();
  document.querySelector('main').inert = false;
  openBtn.setAttribute('aria-expanded', 'false');
}

// Treat "any pixel of the sheet visible inside the popover root" as
// "open enough to count as not closed". This threshold is intentionally
// tiny so the closed callback only fires once the sheet is truly gone.
const visibleThreshold = 1 / window.innerWidth;

const observer = new IntersectionObserver(
  (entries) => {
    // During programmatic scrolling the observer can deliver multiple
    // entries in one batch. Only the most recent describes the
    // current state; earlier entries are intermediate positions.
    const entry = entries.at(-1);
    if (entry.intersectionRatio < visibleThreshold) onDrawerClosed();
    if (entry.intersectionRatio === 1) onDrawerOpened();
  },
  // root: drawer makes the popover element the intersection root,
  // so the ratio reflects the sheet's visibility within the popover
  // (i.e. how much of it has been swiped on-screen).
  {root: drawer, threshold: [visibleThreshold, 1]},
);
observer.observe(sheet);
```

### 5. Wire up the trigger and dismissal handlers

```js
// Open trigger.
openBtn.addEventListener('click', openDrawer);

// Light-dismiss: a tap on the dimmed area (anywhere inside the
// popover but outside the sheet) closes the drawer. We implement
// this manually because popover="manual" disables the browser's
// built-in light-dismiss (which would also fire mid-swipe — see step 1).
drawer.addEventListener('click', (event) => {
  if (!sheet.contains(event.target)) closeDrawer();
});

// Escape key. Listen on document because focus may be inside the
// drawer when the user presses Escape.
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeDrawer();
});
```

### Fallback strategies

Baseline status for Popover: Newly available. It's been Baseline since 2025-01-27.
Supported by: Chrome 116 (Aug 2023), Edge 116 (Aug 2023), Firefox 125 (Apr 2024), Safari 17 (Sep 2023), and Safari iOS 18.3 (Jan 2025).

The drawer's core mechanics — scroll snap, `IntersectionObserver`, and `inert` — are all Baseline Widely available and required for the component to function. The popover API, the scroll-driven animation that fades the backdrop, and `scroll-initial-target` are progressive enhancements with simple fallbacks that can be easily implemented if wide browser support is required.

#### Backdrop fade fallback (no `animation-timeline` support):

Scroll-driven animations has limited availability.
Supported by: Chrome 115 (Jul 2023), Edge 115 (Jul 2023), and Safari 26 (Sep 2025).
Unsupported in: Firefox.

Detect with `CSS.supports('animation-timeline: scroll()')` and write `--drawer-backdrop` from a `scroll` event listener if not supported. The CSS `@supports` block in step 2 ensures the keyframes never apply in unsupported browsers, so the JavaScript value is the only writer.

```js
if (!CSS.supports('animation-timeline: scroll()')) {
  scroller.addEventListener('scroll', () => {
    // Same mapping as the @keyframes: 0 scroll = 1 (open),
    // sheet-width scroll = 0 (closed).
    const ratio = 1 - scroller.scrollLeft / sheet.offsetWidth;
    drawer.style.setProperty('--drawer-backdrop', ratio);
  });
}
```

#### Initial scroll position fallback (no `scroll-initial-target` support):

scroll-initial-target has limited availability.
Supported by: Chrome 133 (Feb 2025) and Edge 133 (Feb 2025).
Unsupported in: Firefox and Safari.

Detect with `CSS.supports('scroll-initial-target', 'nearest')` and inside `openDrawer()`, jump-scroll the scroller to the closed position immediately after `showPopover()`. Without this, the drawer would appear instantly in the open position with no slide-in animation.

```js
async function openDrawer() {
  drawer.showPopover();

  if (!CSS.supports('scroll-initial-target', 'nearest')) {
    // Jump-scroll to the closed stop so the scroll below
    // animates the drawer in from off-screen.
    scroller.scrollTo({left: scroller.offsetWidth, behavior: 'instant'});
    // Wait two animation frames for the jump-scroll to commit.
    // A single rAF is not enough — the second `scrollTo` would
    // cancel the first before the browser has a chance to apply it.
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r))
    );
  }

  scroller.scrollTo({left: 0, behavior: 'auto'});
}
```

#### `@property` fallback (no registered custom properties):

Baseline status for Registered custom properties: Newly available. It's been Baseline since 2024-07-09.
Supported by: Chrome 85 (Aug 2020), Edge 85 (Aug 2020), Firefox 128 (Jul 2024), and Safari 16.4 (Mar 2023).

`@property` is only needed because the scroll-driven animation interpolates `--drawer-backdrop` between keyframes — without registration, the property would be treated as a string and would jump between 0 and 1 with no fade. If the scroll-driven animation fallback above is in place, that JavaScript writes a fresh numeric string to `--drawer-backdrop` on every scroll frame and never interpolates, so no seprarate `@property` fallback is needed since all browsers that support scroll-driven animations also support `@property`.


#### Popover API fallback (no `popover` attribute support):

Baseline status for the api.HTMLElement.showPopover capability: Newly available. It's been Baseline since 2024-04-16.
Supported by: Chrome 114 (May 2023), Edge 114 (Jun 2023), Firefox 125 (Apr 2024), and Safari 17 (Sep 2023).

Because this component uses `popover="manual"` and implements dismissal entirely from JavaScript, it does not depend on the popover API's defining behaviors — light-dismiss, the `popovertarget` attribute, top-layer-managed Escape handling, or focus management. The only popover features it actually uses are top-layer promotion (via `showPopover()`) and the `::backdrop` pseudo-element, which have been Baseline since April 2024.

If wider browser support is needed, do not branch on feature detection — simply do not use popover at all. Drop the `popover="manual"` attribute, replace top-layer promotion with `position: fixed` and a high `z-index`, replace `::backdrop` with a sibling element styled identically (using the same `--drawer-backdrop` custom property), and toggle visibility from a class instead of `showPopover()`/`hidePopover()`. The rest of the component (scroll snap, the scroll-driven backdrop animation, the `IntersectionObserver`, and the dismissal handlers) is unchanged.
