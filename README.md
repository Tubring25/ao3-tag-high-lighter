# AO3 Tag Highlighter

AO3 Tag Highlighter is a desktop Chrome extension for Archive of Our Own readers. It lets you create local tag rules that highlight tags, show warning markers, and collapse matching works on AO3 pages.

## Features

- Highlight relationship, character, and freeform tags on AO3.
- Show warning bars for tags you want to notice before reading.
- Collapse works that match your collapse rules on listing pages.
- Show collapse-rule matches on work detail pages without changing the story text.
- Add rules directly from AO3 tags with the hover `+` quick-add menu.
- Manage rules from the extension Options page.
- Search, filter, edit, pause, delete, and bulk-delete rules.
- Use exact, contains, or wildcard matching.
- Customize highlight and warning tag colors.
- Switch UI language between English, Simplified Chinese, or browser default.
- Store all rules and settings locally in your browser.

## Supported browser and site

- Desktop Chrome / Chromium browsers using Manifest V3.
- `https://archiveofourown.org/*`.

## Install for local development

```sh
npm install
npm run build
```

Then load the built extension:

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Choose **Load unpacked**.
4. Select the `dist/` folder.

## Development commands

```sh
npm run dev             # watch build
npm run build           # production build
npm run lint            # TypeScript check
npm run test            # Vitest test suite
npm run verify          # build + lint + test
npm run verify:release  # release-oriented checks
```

## Privacy

AO3 Tag Highlighter is local-only.

Data stored locally:

- Tag rules created by the user
- Extension settings
- Tag style settings
- Language preference

This data is stored in the user's browser with `chrome.storage.local`.

AO3 Tag Highlighter does not collect, transmit, sell, share, or remotely process user data. It does not use analytics, advertising, cloud sync, account login, or remote scraping. The extension only reads visible AO3 page content in the user's browser so it can apply local visual changes such as tag highlighting, warning indicators, and collapsed work placeholders.

## Permissions

- `storage`: saves rules and settings locally in the browser.
- `https://archiveofourown.org/*`: reads visible AO3 tags and applies local visual changes on AO3 pages.

## License

No license has been selected yet.
