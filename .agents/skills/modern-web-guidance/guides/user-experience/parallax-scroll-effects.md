# Build a Parallax Effect on Scroll

A parallax effect on scroll is a visual technique where different layers of content move at varying speeds as the user scrolls down a page. This creates an illusion of depth, with foreground elements appearing to move faster than the background elements, resulting in an engaging and immersive browsing experience. This effect is best achieved using CSS Scroll-Driven Animations, which allow you to link animations to the scroll position of a container.

## How to implement

Here’s how to create a basic parallax effect:

1.  **Create a wrapper element:** This element simply groups all the layers of the parallax effect together. It is not the scrollable element, so its overflow should be clipped. Also give it a `height` that matches the height of one of the layers of the parallax effect.

    ```html
    <div class="wrapper">
      …
    </div>
    ```

    ```css
    .wrapper {
      overflow: clip;
      height: 100vh; /* Height of one of the layers of the parallax */
    }
    ```

2.  **Declare the layers:** Inside the wrapper, add the individual layers that will move at different speeds.

    ```html
    <div class="wrapper">
      <div class="layer">LAYER 0</div>
      <div class="layer">LAYER 1</div>
      <div class="layer">LAYER 2</div>
      …
    </div>
    ```

3.  **Add a translate animation:** Define a CSS animation that changes the `transform` property of the layers. For a parallax effect, you'll typically use `translateY` to move the layers vertically.

    ```css
    @keyframes parallax {
      from {
        transform: translateY(700px);
      }
    }
    ```

4.  **Set up the `view-timeline`:** To link the animation to the scroll position, create a `view-timeline` on the wrapper element and then apply it to the layers.

    ```css
    .wrapper {
      view-timeline: --wrapper;
    }

    .layer {
      animation: parallax linear both;
      animation-timeline: --wrapper;
    }
    ```

5.  **Stagger the animations:** To make the layers move at different speeds, you can use one of two main approaches: **staggering in the keyframes**, or **staggering the `animation-range`**. 

    Both of these approaches can use hardcoded values, or can use the `sibling-index()`/`sibling-count()` implementation. The hardcoded values are easiest and also useful when having only a limited amount of layers. The `sibling-index()`/`sibling-count()` implementation is handy when you have many layers.

    *   **Staggering in the keyframes:**

        Using **hardcoded values**, you can define a custom property for each layer to manually control its parallax offset.

        ```css
        .layer:nth-child(1) { --offset: 100px; }
        .layer:nth-child(2) { --offset: 200px; }
        .layer:nth-child(3) { --offset: 300px; }

        @keyframes parallax {
          from {
            transform: translateY(var(--offset));
          }
        }
        ```

        Using **`sibling-index()`**, let the `sibling-index()` function return the index of a child element amongst its siblings to automatically calculate the staggered effect.

        ```css
        @keyframes parallax {
          from {
            transform: translateY(calc(100px * sibling-index()));
          }
        }
        ```

    *   **Staggering the `animation-range`:**

        Using **hardcoded values**, you can explicitly define the boundaries of the `animation-range` on each layer individually.

        ```css
        .layer:nth-child(1) { animation-range: entry 25% exit 50%; }
        .layer:nth-child(2) { animation-range: entry 25% exit 75%; }
        .layer:nth-child(3) { animation-range: entry 25% exit 100%; }
        ```

        Using **`sibling-index()` and `sibling-count()`**, you can calculate the range mathematically based on the total number of layers (`sibling-count()`).

        ```css
        .layer {
          animation-range: entry 25% exit calc(100% / sibling-count() * sibling-index());
        }
        ```

## Example code

```css
@keyframes parallax {
  from {
    transform: translateY(calc(100px * sibling-index()));
  }
}

.wrapper {
  view-timeline: --wrapper;
}

.layer {
  animation: parallax linear both;
  animation-timeline: --wrapper;
}

@media (prefers-reduced-motion: reduce) {
  .layer {
    animation: none;
  }
}
```

Alternatively, you can use the `animation-range` property to achieve a similar effect:

```css
@keyframes parallax {
  from {
    transform: translateY(700px);
  }
}

.wrapper {
  view-timeline: --wrapper;
}

.layer {
  animation: parallax linear both;
  animation-timeline: --wrapper;
  animation-range: entry 25% exit calc(100% / sibling-count() * sibling-index());
}

@media (prefers-reduced-motion: reduce) {
  .layer {
    animation: none;
  }
}
```

## Best Practices

When using scroll-driven animations, it's important to follow a few best practices to ensure a smooth and accessible experience:

- **DO** include feature detection: Not all browsers support scroll-driven animations. Use `@supports ((animation-timeline: view()) and (animation-range: entry))` to check for support and provide a fallback for browsers that don't support it.
  - The `(animation-range: entry)` check **MUST** be included here, to filter out browsers with only partial support.
  - **DO NOT** use the `scroll-timeline-polyfill` package for the fallback strategy as it is not feature complete and has a lot of known issues.
  - If the animation is only considered to be decorative, opt for Progressive Enhancement and **DO NOT** provide a fallback.
- **DO** respect user preferences: Some users prefer to have less motion on the web. Use the `prefers-reduced-motion` media query to disable or reduce your animations for these users.
- **DO** try to animate only performant CSS properties: For the smoothest animations, stick to animating properties that can be handled by the browser's compositor thread, such as `transform` and `opacity`. Animating other properties like `width` or `height` can lead to performance issues.
- **DO** use the correct declaration order: When using the `animation` shorthand property, declare `animation-timeline` and `animation-range` *after* it to prevent the shorthand from resetting the timeline.

As for setting the `animation-range`:

- **DO** give all layers the same start offset, e.g. `entry 25%`
- **DO** give all layers a different end offset that uses `sibling-count()` and `sibling-index()` to distribute the offsets, e.g. `exit calc(100% / sibling-count() * sibling-index())`.


## Browser support and fallback strategies

Scroll-driven animations has limited availability.
Supported by: Chrome 115 (Jul 2023), Edge 115 (Jul 2023), and Safari 26 (Sep 2025).
Unsupported in: Firefox.. Therefore, a fallback strategy is typically required.

For browsers that do not support scroll-driven animations, you can use a fallback to recreate the visual effects. The fallbacks are typically built with either a scroll listener (for ScrollTimeline effects) or the IntersectionObserver API (for ViewTimeline effects).

In browsers with built-in support for scroll-driven animations, ALWAYS use the native CSS implementation as those are more performant.

Note that not every effect can be recreated using the fallbacks approach.

For this use-case specifically, the following script applies the fallback for browsers that do not support scroll-driven animations. It uses an `IntersectionObserver` to track the visibility of the `.wrapper` element and updates the `transform` property of the layers based on the scroll position.

```js
// Fallback for browsers that don't support scroll-driven animations
if (!CSS.supports('(animation-timeline: view()) and (animation-range: entry)')) {
  const wrapper = document.querySelector('.wrapper');
  const layers = document.querySelectorAll('.layer');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        window.addEventListener('scroll', onScroll);
      } else {
        window.removeEventListener('scroll', onScroll);
      }
    });
  }, { threshold: 0 });

  observer.observe(wrapper);

  function onScroll() {
    const scrollY = window.scrollY;
    const wrapperRect = wrapper.getBoundingClientRect();
    const wrapperTop = wrapperRect.top + scrollY;
    const wrapperHeight = wrapperRect.height;
    const windowHeight = window.innerHeight;

    if (scrollY >= wrapperTop - windowHeight && scrollY <= wrapperTop + wrapperHeight) {
      const scrollPercent = (scrollY - (wrapperTop - windowHeight)) / (wrapperHeight + windowHeight);
      
      layers.forEach((layer, index) => {
        // This matches the effect as defined in the CSS example above.
        // Customize this further if needed.
        const initialTranslateY = 100 * index;
        const translateY = initialTranslateY * (1 - scrollPercent);
        layer.style.transform = `translateY(${translateY}px)`;
      });
    }
  }

  // Trigger onScroll once to set initial positions
  onScroll();
}
```
