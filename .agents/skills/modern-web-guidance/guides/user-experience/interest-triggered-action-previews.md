It can be beneficial to provide users a preview of their actions before they commit to them. Interest invokers are an experimental web platform feature that provides a declarative-based way of creating interest relationships between an interest source (i.e. a button or a link) and an interest target. Once the declarative relationship has been established there are a number of methods a developer can respond to based on interest and loss of interest using both CSS and JavaScript. For this use case, we can leverage the `interest` and `loseinterest` events to preview various effects for an interest target.

## How to implement

An interest relationship is created by setting the `interestfor` attribute on a button or link (i.e. the interest source). The attribute takes an ID reference to another element (i.e. the interest target). Interest invokers or sources can only have a single interest target, but an interest target can have multiple interest invokers.

```html
<!-- MANDATORY: interest relationships must be established with the `interestfor` attribute on a button or a link -->
<button interestfor="interestingElement" data-effect="A">Some effect</button>
<button interestfor="interestingElement" data-effect="B">Some other effect</button>
<div id="interestingElement">Something interesting</div>
```

For the sake of this use case, we can leverage the `interest` and `loseinterest` events to preview various effects for an interest target. Both of these events are `InterestEvent`s which has a `source` property which is the source of the interest (i.e. the element with the `interestfor` attribute).

```javascript
interestingElement.addEventListener("interest", event => {
  // Apply the preview based on `event.source`
  event.target.dataset.preview = event.source.dataset.effect;
});

interestingElement.addEventListener("loseinterest", event => {
  // Unapply the preview
  delete event.target.dataset.preview;
});
```

> [!NOTE]
> **Don't announce interest-driven previews via a live region.** Interest can be triggered just by moving the pointer across the page or tabbing through nearby buttons, so apply/unapply announcements quickly become noise that can drown out content the user actually cares about. The preview itself is the affordance; users who can perceive it benefit directly, and those who can't will not benefit from a verbal echo of "Previewing effect: A". If you decide you genuinely need an announcement for a specific case, make sure to test it carefully with users.

Active interest sources and targets can be selected with CSS using the `:interest-source` and `:interest-target` pseudo-selectors respectively.

```css
/* Styles to apply when the effect is being previewed */
:interest-source {}
:interest-target {}
```

The start and end delay for an interest invoker (i.e. the element with the `interestfor` attribute) can be set with the `interest-delay-start` and `interest-delay-end` CSS properties or the shorthand `interest-delay` property.

```css
[interestfor] {
  interest-delay-start: 0.2s;
  interest-delay-end: 0.1s;
}
```

### Fallback strategies

Interest invokers has limited availability.
Supported by: Chrome 142 (Oct 2025) and Edge 142 (Oct 2025).
Unsupported in: Firefox and Safari.

Interest invokers must be conditionally polyfilled using the `interestfor` polyfill package from NPM. Do prefer bundling the polyfill over using the CDN.

```html
<script type="module">
  if(!HTMLButtonElement.prototype.hasOwnProperty("interestForElement")){
    // CDN link only used for example, prefer bundling.
    await import("https://unpkg.com/interestfor@latest");
  }
</script>
```

When using the polyfill the CSS API changes slightly for the `:interest-source` and `:interest-target` pseudo-classes, as well as, the `interest-delay`, `interest-delay-start`, and `interest-delay-end` properties:

```css
/* Styles to apply when the effect is being previewed */
:is(:interest-source, .interest-source) {}
:is(:interest-target, .interest-target) {}

/* Adjust the start and end delay for interest invokers */
[interestfor] {
  --interest-delay-start: 0.2ms;
  interest-delay-start: 0.2ms;
  --interest-delay-end: 0.1ms;
  interest-delay-end: 0.1ms;
}
```