## 2021-10-04

- Refactored `trackedToSentry_pre` and `trackedToSentry_post` phrases — which used concatenation to insert an error ID value between them — into a single `trackedToSentry` phrase that uses interpolation to insert the error ID value. #4026

## 2020-10-13

- Added ability to embed scene source into exported PNG/SVG files so you can import the scene from them (open via `Load` button or drag & drop). #2219
