# Licensing and attribution

- Upstream **Excalidraw is MIT-licensed** (`LICENSE` at the repo root). It is used as-is; no copyright or license notices were removed, and none of the editor's source is copied into the new packages — the workspace app _imports_ `@excalidraw/*` from the monorepo.
- **No proprietary Excalidraw+ code, assets or APIs** are used. The platform re-implements _publicly documented behaviour_ (accounts, teams, sharing, comments, presentations, exports, AI, integrations) with its own code, UI and data model. It contains no calls to `excalidraw.com` or `plus.excalidraw.com`.
- The UI is original (own layout, icons and styling).

## Dependencies added by the workspace platform

Checked before adding; all are permissive and compatible with MIT distribution.

| Package | Used for | License |
| --- | --- | --- |
| fastify, @fastify/cookie, @fastify/rate-limit, @fastify/websocket | API server | MIT |
| mongodb (official driver) | Database | Apache-2.0 |
| @aws-sdk/client-s3 | Optional S3-compatible storage | Apache-2.0 |
| ws | WebSocket | MIT |
| zod | Validation | MIT |
| dotenv | Config loading | BSD-2-Clause |
| tsx | Dev/start runner | MIT |
| react-router-dom | Web app routing | MIT |
| jspdf, svg2pdf.js | Vector PDF export | MIT |
| fontkit | Glyph outlines for PDF text | MIT |
| pptxgenjs | PowerPoint export | MIT |
| idb-keyval | Local drafts / chat history | Apache-2.0 |

Apache-2.0 dependencies are consumed as installed npm packages (their `LICENSE`/`NOTICE` files stay in `node_modules` and in your container image); nothing is vendored or modified.

Fonts used in exports are the editor's own bundled fonts (Excalifont, Nunito, Comic Shanns, Liberation Sans, …), each under its own open license as shipped in `packages/excalidraw/fonts`. Outlines are embedded in PDFs the same way any exported SVG/PNG already embeds them.

MongoDB itself (server) is not distributed by this project; install it under its own license.
