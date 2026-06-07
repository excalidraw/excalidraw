# Landing page performance benchmark

Methodology: Playwright headless Chromium, service workers blocked, cache-bust query on each cold run (`?bench=<timestamp>`), 3 cold + 3 warm runs per environment. Median values reported.

Run locally:

```bash
yarn build:pages
cd excalidraw-app && npx vite preview --port 5000 --host 127.0.0.1
yarn benchmark:landing
yarn benchmark:landing:preview   # after CF Pages deploy
```

## Before vs after (2026-06-07)

| Metric (cold median) | Prod baseline (`tfdraw.dev`, pre-deploy) | Local optimized build |
| --- | --- | --- |
| FCP | 844 ms | **344 ms** (−59%) |
| LCP | 852 ms | **596 ms** (−30%) |
| TBT | 21 ms | 12 ms |
| DOMContentLoaded | 767 ms | **245 ms** (−68%) |
| Total transfer | **3018 KB** | **1470 KB** (−51%) |
| Requests | 25 | 29 |

| Metric (warm median) | Prod baseline  | Local optimized         |
| -------------------- | -------------- | ----------------------- |
| FCP                  | 240 ms         | **48 ms**               |
| LCP                  | 832 ms         | **376 ms**              |
| Total transfer       | ~0 KB (cached) | ~4 KB (HTML revalidate) |

## What changed

1. **Route-level code splitting** — `EditorApp.tsx` extracted; landing `/` lazy-loads editor only on scroll or `/demo` navigation. Landing entry `index-*.js` is ~19 KB (was ~1.18 MB wire on prod).
2. **og-image preload** — `<link rel="preload" href="/og-image.png" …>` in `index.html`.
3. **Dead assets removed** — `public/screenshots/` deleted; PWA manifest screenshots dropped. CI guards brand PNG sizes in `pages-deploy.yml`.
4. **Chunk tuning** — Removed `mermaid` manual chunk (it was hosting Vite’s preload helper on landing). Split `email-signup` and async `sentry` chunks.

## Optimization verdict

| Optimization | Landing perf impact | Notes |
| --- | --- | --- |
| Route splitting | **High** | Largest win: ~1.5 MB less cold transfer, FCP −500 ms vs prod |
| og-image preload | **Low–medium** | Helps hero LCP on optimized 18 KB asset; prod still serves 262 KB og-image until redeploy |
| Trim screenshots | **None on first paint** | ~180 KB smaller deploy; manifest only |

## Remaining gaps

- **Prod brand assets** still bloated (`tfdraw-logo.png` 1.38 MB, `og-image.png` 262 KB). Committed `public/` files are 16–18 KB; redeploy fixes this.
- **Sentry chunk** (~132 KB) modulepreloaded on landing via async import side effects.
- **Excalidraw font preloads** (4× DO CDN, ~90 KB) still in every HTML response.
- **Cloudflare Pages preview** (`terraform-feature.ainur-chb.pages.dev`) was unavailable during this run; use `yarn benchmark:landing:preview` after deploy.

## Caching notes for future runs

- Disable service workers in DevTools when measuring manually.
- Hard-reload or cache-bust hashed assets; HTML always revalidates on Pages.
- Warm runs reuse HTTP cache for hashed JS/CSS; parse/compile cost remains on repeat visits.
