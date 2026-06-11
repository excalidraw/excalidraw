# Improve next page load performance

One of the most effective ways to improve page load performance for users navigating a site is to initiate loading the next page they're about to visit *before* they visit it. This can be done through a technique called speculative loading using the Speculation Rules API.

## How it works

Speculative loading works by using JSON-based speculation rules to tell the browser about links that can be prefetched or prerendered improving page load performance when user clicks on them.

The rules can either be a hardcoded list of URLs a `urls` key (known as a list rule), or with a `where` key containing a set of href and CSS selectors used to find links on the page (known as a `document` rule).

Rules can also include an optional `eagerness` property that specifies when the page should be prefetched or prerendered. The `eagerness` property can be set to `immediate`, `eager`, `moderate`, or `conservative`. `immediate` speculates as soon as possible, while the others wait for user signals such as hovering for a short period, for a longer period, or starting to click on the page respectively.

Rules can be combined with different eagerness settings to prefetch eagerly and then prerender when the user interacts more.

## When to use it

Speculative loading is especially useful for static pages, where the content is not likely to change often, and where pages are cheaper to produce—especially if cached at the edge. It can also be used for dynamic pages, but it is important to be careful about the potential for stale content.

Speculative loading is typically used for same-origin links, though more advanced options allow for some cross-origin speculation. This guide concentrates on the more-common same-origin use case.

More eager speculative loading is a good choice for pages that are likely to be visited next, such as a headline article or the next page in a stepped process like a learning a course.

Less eager speculative loading is a good choice when it is less obvious what the user will do next, when there are many links on the page, each equally likely to be visited. By waiting for more signals, such as hovering, or starting to click on the page, you can get a head-start on the next page and improve the user experience, even if it is not fully prefetched or prerendered.

Similarly, prefetch is a more conservative choice than prerender, using less resources (on both the client and the server side) but providing less benefit to the user. It is a good choice for initial implementation, expanding to prerender later when the developer explicitly requests it.

## How to use it

Speculation rules have a JSON-based format and can be included in a `<script type="speculationrules">` tag. The rules can be included in the `<head>` or `<body>` of the document, or can be dynamically added using JavaScript.

A `tag` can also be used, either at a global level or on a per-rule basis. When set, this tag will be included in the `Sec-Speculation-Tags` header, and allows you to identify server-side which speculations were made.

### Example of a simple URL list rule for prefetching predefined URLs

```html
<script type="speculationrules">
  {
    "tag": "product-page-speculations",
    "prefetch": [
      {
        "urls": ["/product/1", "/product/2", "/product/3"]
      }
    ]
  }
</script>
```

### Example of a simple document rule for prerendering all same-origin links on a page

```html
<script type="speculationrules">
  {
    "tag": "all-links-speculations",
    "prerender": [{
      "where": { "href_matches": "/*" }
    }]
  }
</script>
```

### Example of a complex document rule for prerendering links with exclusions for interactive sites

```html
<script type="speculationrules">
  {
    "tag": "speculations-with-exclusions",
    "prerender": [{
      "where": {
        "and": [
          { "href_matches": "/*" },
          { "not": {"href_matches": "/wp-admin"}},
          { "not": {"href_matches": "/*\\?*(^|&)add-to-cart=*"}},
          { "not": {"selector_matches": ".do-not-prerender"}},
          { "not": {"selector_matches": "[rel~=nofollow]"}}
        ]
      }
    }]
  }
</script>
```

### Example of a mixed rule set

This example shows a rule set that prefetches all links eagerly, and then goes further than this to prerender those same links when it gets more signals with `moderate` eagerness.

```html
<script type="speculationrules">
  {
    "prefetch": [{
      "tag": "prefetch-speculations",
      "where": { "href_matches": "/*" },
      "eagerness": "eager"
    }],
    "prerender": [{
      "tag": "prerender-speculations",
      "where": { "href_matches": "/*" },
      "eagerness": "moderate"
    }]
  }
</script>
```

## Best Practices

- **DO** use speculation rules to prefetch and prerender pages that the user is likely to visit next.
- **DO** use speculation rules for static sites, where the content is not likely to change often, and where pages are cheaper to produce—especially if cached at the edge.
- **DO** take more care when using speculation rules for dynamic pages, where the content is more likely to change often, may become out of date, and where pages are more expensive to produce.
- **DO** prefer document rules over list rules, as they are more flexible, allow the same rule to be shared across multiple pages, and can be used to prefetch and prerender pages that are not known in advance.
- **DO** consider the trade-offs between prefetch and prerender, and choose the appropriate one for your use case. Prerender is more expensive than prefetch and can cause more unintended side effects in complex applications that display dynamic state, but provides a better user experience. Ask the developer for their preference if unsure.
- **DO** consider the trade-offs between the different `eagerness` levels, and choose the appropriate one for your use case. More eager speculation provides a better user experience but uses more resources and can cause more unintended side effects in complex applications that display dynamic state. Ask the developer for their preference if unsure.
- **DO NOT** overuse speculation rules, for example, to speculate every link on the page. Browsers have limits (2 speculations for non-eager speculations). `immediate` should only be used for a very small number of links.
- **DO NOT** speculate URLs that likely trigger state changes, like `/logout` or `/add-to-cart`, and explicitly exclude them from your speculation rules if they are likely to be included in document rules.
- **DO NOT** use speculation rules on Single Page Applications (SPAs). Speculation rules are designed for multi-page applications (MPAs) where the browser navigates to a new document on each navigation. In SPAs, the browser does not navigate to a new document on each navigation, so speculation rules will not work as expected.

## Browser support and fallback strategies

Speculative loading is a new feature, and as such, is not supported in all modern browsers (Baseline limited availability).

However, speculative loading is a progressive enhancement. It is perfectly safe to use as an enhancement, and is highly recommended given the potential performance benefits. If a browser does not support speculation rules, it will simply ignore them.
