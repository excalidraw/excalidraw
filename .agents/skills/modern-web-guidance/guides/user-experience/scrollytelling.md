# Scrollytelling

Scrollytelling is a popular technique used to create engaging and immersive web experiences. It involves animating elements on a page as the user scrolls, effectively telling a story or guiding the user through a narrative. With CSS Scroll-Driven Animations, you can create these effects directly in CSS, without needing to rely on JavaScript. The animations are controlled by the scroll position, not a time-based clock, which ensures they are always in sync with the user's scroll.

## How to implement

To create a scrollytelling experience, you need two sets of elements: one to track the scroll position and another to be animated.

First, define a named `view-timeline` on the elements you want to track. These will act as the drivers for your animations.

```css
#tracked {
  section:nth-child(1){ view-timeline: --tl-1 block; }
  section:nth-child(2){ view-timeline: --tl-2 block; }
  section:nth-child(3){ view-timeline: --tl-3 block; }
  section:nth-child(4){ view-timeline: --tl-4 block; }
  section:nth-child(5){ view-timeline: --tl-5 block; }
}
```

Next, apply animations to the elements you want to animate and link them to the timelines you just created using the `animation-timeline` property.

```css
#animated {
  section {
    animation: animate-in auto linear both, animate-out auto linear forwards;
    animation-range: entry 25% cover 50%, exit 50% exit 75%;
  }

  section:nth-child(1){ animation-timeline: --tl-1; }
  section:nth-child(2){ animation-timeline: --tl-2; }
  section:nth-child(3){ animation-timeline: --tl-3; }
  section:nth-child(4){ animation-timeline: --tl-4; }
  section:nth-child(5){ animation-timeline: --tl-5; }
}
```

For the `animation-timeline` to be able to reference the named timelines, they need to be in the same scope. You can use the `timeline-scope` property on a common ancestor to make the timelines available to all the elements that need them. The `:root` element is often a good choice for this.

```css
html {
  timeline-scope: --tl-1, --tl-2, --tl-3, --tl-4, --tl-5;
}
```

Finally, you can use the `animation-range` property to specify the exact range of the timeline during which the animation should run. This gives you fine-grained control over when the animations are triggered and how they progress.

```css
#animated section {
  animation-range: entry 25% cover 50%, exit 50% exit 75%;
}
```

## Example code

```css
html {
  timeline-scope: --tl-1, --tl-2, --tl-3, --tl-4, --tl-5;
}

#tracked {
  section:nth-child(1){ view-timeline: --tl-1 block; }
  section:nth-child(2){ view-timeline: --tl-2 block; }
  section:nth-child(3){ view-timeline: --tl-3 block; }
  section:nth-child(4){ view-timeline: --tl-4 block; }
  section:nth-child(5){ view-timeline: --tl-5 block; }
}

@keyframes animate-in {
  from { scale: 0.5; opacity: 0; transform: rotateY(-180deg); }
  to { transform: rotateY(0deg); }
}
@keyframes animate-out {
  to { translate: 100% 0; opacity: 0; }
}

#animated {
  section {
    animation: animate-in auto linear both, animate-out auto linear forwards;
    animation-range: entry 25% cover 50%, exit 50% exit 75%;
    backface-visibility: hidden;
  }

  section:nth-child(1){ animation-timeline: --tl-1; }
  section:nth-child(2){ animation-timeline: --tl-2; }
  section:nth-child(3){ animation-timeline: --tl-3; }
  section:nth-child(4){ animation-timeline: --tl-4; }
  section:nth-child(5){ animation-timeline: --tl-5; }
}

/* MANDATORY Copy-Paste Safety: Disable continuous storytelling motion for sensitive users */
@media (prefers-reduced-motion: reduce) {
  #animated section {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
```

## Best Practices

When using scroll-driven animations, it's important to follow a few best practices to ensure a smooth and accessible experience:

- **DO** include feature detection: Not all browsers support scroll-driven animations. Use `@supports ((animation-timeline: scroll()) and (animation-range: 0% 100%))` to check for support and provide a fallback for browsers that don't support it.
  - The `(animation-range: 0% 100%)` check **MUST** be included here, to filter out browsers with only partial support.
  - **DO NOT** use the `scroll-timeline-polyfill` package for the fallback strategy as it is not feature complete and has a lot of known issues.
  - If the animation is only considered to be decorative, opt for Progressive Enhancement and **DO NOT** provide a fallback.
- **DO** respect user preferences: Some users prefer to have less motion on the web. Use the `prefers-reduced-motion` media query to disable or reduce your animations for these users.
- **DO** try to animate only performant CSS properties: For the smoothest animations, stick to animating properties that can be handled by the browser's compositor thread, such as `transform` and `opacity`. Animating other properties like `width` or `height` can lead to performance issues.
- **DO** use the correct declaration order: When using the `animation` shorthand property, declare `animation-timeline` and `animation-range` *after* it to prevent the shorthand from resetting the timeline.

When using the `view-timeline` property to create a scroll-driven animation:

- **DO** use a CSS `<dashed-ident>` for the name.
- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `view-timeline-axis`.
- **DO** make sure the scope of the lookup works: When the element that is declaring the `view-timeline` is not a flat tree ancestor of the animated element, hoist up the visibility of the `view-timeline`’s name by using `timeline-scope` on a shared ancestor.

## Fallback strategies

Scroll-driven animations has limited availability.
Supported by: Chrome 115 (Jul 2023), Edge 115 (Jul 2023), and Safari 26 (Sep 2025).
Unsupported in: Firefox.

For browsers that do not support scroll-driven animations, you can use a fallback to recreate the visual effects. The fallbacks are typically built with either a scroll listener (for ScrollTimeline effects) or the IntersectionObserver API (for ViewTimeline effects).

In browsers with built-in support for scroll-driven animations, ALWAYS use the native CSS implementation as those are more performant.

Note that not every effect can be recreated using the fallbacks approach.

For this use-case specifically, the following script applies the fallback for browsers that do not support scroll-driven animations. It uses an `IntersectionObserver` to track the visibility of each `#tracked section` element and updates the `transform` property of the corresponding `#animated section` accordingly.

```js
const animatedSections = document.querySelectorAll('#animated section');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    const sectionIndex = Array.from(document.querySelectorAll('#tracked section')).indexOf(entry.target);
    if (sectionIndex !== -1) {
      const animatedSection = animatedSections[sectionIndex];
      const ratio = entry.intersectionRatio;

      // Animate-in
      animatedSection.style.opacity = ratio;
      animatedSection.style.transform = `scale(${0.5 + ratio * 0.5}) rotateY(${-180 + ratio * 180}deg)`;

      // Animate-out
      if (ratio < 0.5) {
        animatedSection.style.translate = `${(0.5 - ratio) * 2 * 100}% 0`;
      } else {
        animatedSection.style.translate = '0 0';
      }
    }
  });
}, { threshold: Array.from({length: 101}, (_, i) => i / 100) });

document.querySelectorAll('#tracked section').forEach(section => {
  observer.observe(section);
});
```

And the accompanying CSS:

```css
#animated section {
  opacity: 0;
  transform: scale(0.5)  rotateY(-180deg);
  backface-visibility: hidden;
}

/* MANDATORY Copy-Paste Safety: Ensure content remains fully visible and legible for assistive technologies or users with motion sensitivities */
@media (prefers-reduced-motion: reduce) {
  #animated section {
    opacity: 1 !important;
    transform: none !important;
    translate: 0 0 !important;
  }
}
```

This fallback provides a more accurate, scroll-driven animation for browsers that do not support the native CSS feature, ensuring a more consistent experience for all users. By using a series of thresholds for the `IntersectionObserver`, we can track the scroll position with more precision and create a smoother animation.