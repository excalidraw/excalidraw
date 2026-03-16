We are looking to integrate `scrollConstraints` in our host app with our presentations feature. The presentation features a read-only Editor in which pressing next or prev zooms on the next/prev frame with `excalidrawAPI.scrollToContent()`.

As previously established in scroll-constraints.md, you can zoom **in** freely on a scroll-constrained area because zoom is only ever **locked to a minimum %**. What this means in practice for presentations is that setting `scrollConstraints` (either via the imperative API or as editor props) will **not** be enough. Imagine the following scenario:

- Frame 1 fills the viewport at 493% using `scrollConstraints`.
- Frame 2 _would_ fill the viewport at 193%.

This means that the new minimum for Frame 2 is 193%. But since 493 > 193, and since there is no constraint on zooming in, `scrollConstraints` sees no reason to zoom you back out to 193.

Therefore, we'll still have to do it "manually" which we currently achieve by using `excalidrawAPI.scrollToContent()`.

This, in turn, however, comes with its own complications. Conventional logic would dictate that:

- first you use `excalidrawAPI.scrollToContent()` to scroll & zoom to the frame
- second, you set the scroll constraints around said frame

This sounds fine in theory but it currently fails in practice for a couple of reasons.

First, there is no way to tell when it's safe to run `excalidrawAPI.setScrollConstraints(sc)` after `excalidrawAPI.scrollToContent()`. The editor does not report when either action has finished animating/translating the canvas. These are not promise-based actions, nor do they emit any events that could be capture as far as I know. As such, you can easily end up with race conditions where `setScrollConstraints` hijacks the previously unfinished `scrollToContent` and you end up in some super weird state. Ask me how I know.

Second, even if you hack it via some generous delay with `setTimeout` (ugh), there is another problem.

```ts
excalidrawAPI.scrollToContent(someFrame, {
  fitToViewport: true,
  viewportZoomFactor: PRESENTATION_CONFIG.viewportZoomFactor,
});
```

and

```ts
excalidrawAPI.setScrollConstraints({
  {...frameXyAndWidthHeigh},
  viewportZoomFactor: PRESENTATION_CONFIG.viewportZoomFactor,
})
```

produces an ever so slightly different zoom level! Staying with my previous example, and this is from a real test, `scrollToContent` puts Frame A at 490% whereas `setScrollConstraints` prefers 493% for the very same frame.

So even if you could ensure that no race conditions happen, what you'd end up seeing switching to any frame is seeing the frame zoom in a few more percent after the initial animation has finished. Kinda janky.

In my opinion, the cleanest solution would be if `scrollToContent` could accept a `shouldLock` flag or perhaps even a `lockTo` object (if we want to customise oversroll, lockzoom, etc) or something in that vein. Then the host-app/consumer wouldn't need to concern itself with race conditions and such and could simply optionally lock the scroll to the content that `scrollToContent` has been instructed to scroll to.
