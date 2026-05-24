# tfdraw.dev privacy note

## Terraform imports

Terraform plan JSON, graph DOT, state files, and `.tfd` dataflow links are parsed **in your browser**. They are **not** uploaded to tfdraw.dev for the import feature.

## Optional email signup

If you subscribe on the landing page or after an import, we store:

- Your email address
- Where you signed up (`landing` or `post_import`)
- When you subscribed

We use this only for occasional product updates about tfdraw.dev.

## Anonymous usage counters

The hosted app may record **aggregate** counters when a Terraform import succeeds or fails. We do **not** store plan contents, resource names, or file metadata—only whether the import completed.

## Third parties

- **Cloudflare** hosts the site and runs the signup/counter API (D1, KV).
- **Turnstile** (optional) may be used on the email form for spam protection.
- **Simple Analytics** may load on production builds for page-view statistics (no Terraform file data).

## Contact

Open an issue on [GitHub](https://github.com/TusharSariya/excalidraw-tf) for privacy questions.
