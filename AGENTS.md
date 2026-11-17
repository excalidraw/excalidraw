# Guidelines

- For new DOM/browser API usage, use `app.ownerDocument` and `app.ownerWindow` instead of globals; without `app`, derive them from the mounted node's `ownerDocument` and its `defaultView`.
- When overriding properties of an existing type, prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit<Base, keyof Overrides> & Overrides`.

# Crowdin (translations)

- Crowdin is the source of truth for `packages/excalidraw/locales/*.json` (except `en.json`); edits committed to locale files are overwritten on the next sync. Upload them with the Crowdin CLI instead.
- Always pass `-b master` (the source file lives in the Crowdin `master` branch).
- Upload only from an up-to-date `l10n_master` checkout: older locale files get imported as extra translations and can override translators' newer fixes.
- Always limit uploads to the edited languages with `-l <lang>`; without it, all languages are uploaded.
