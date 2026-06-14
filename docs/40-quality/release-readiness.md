# Release Readiness Checklist

Last updated: 2026-06-14

## Current release target

- Product: AO3 Tag Highlighter
- Version: `0.1.0`
- Browser: Desktop Chrome, Manifest V3
- Package source: `dist/` after `npm run build`

## Code readiness

- [x] MV3 manifest builds successfully.
- [x] AO3 listing pages and work detail pages are handled.
- [x] Tag matching supports exact / contains / wildcard.
- [x] Rule actions support highlight / warning / collapse work.
- [x] Popup, options page, quick-add menu, and user guide are implemented.
- [x] Local-only settings and rules are stored in `chrome.storage.local`.
- [x] English and Simplified Chinese UI strings are available.
- [x] `npm run build` passes.
- [x] `npm run lint` passes.
- [x] `npm run test` passes.

## Before packaging

- [ ] Add extension icons and wire them in `manifest.json`:
  - [ ] `icons.16`
  - [ ] `icons.32`
  - [ ] `icons.48`
  - [ ] `icons.128`
  - [ ] `action.default_icon`
- [ ] Remove macOS metadata from the package output:
  - [ ] `public/.DS_Store`
  - [ ] `dist/.DS_Store`
- [ ] Rebuild from a clean output directory.
- [ ] Load `dist/` as an unpacked extension in Chrome.
- [ ] Confirm extension name, description, action tooltip, popup, and options page render correctly.

## Manual QA

Run against real AO3 pages before creating the release zip.

- [ ] Search results / tag listing page:
  - [ ] Tags are parsed.
  - [ ] Highlight rules color the correct tags.
  - [ ] Warning rules show the warning bar.
  - [ ] Collapse rules collapse the whole work block and show matched reasons.
  - [ ] Collapsed work can be expanded and hidden again.
- [ ] Work detail page:
  - [ ] Article content is not modified.
  - [ ] Warning / caution bars appear only in the metadata area.
  - [ ] Warning bar is hidden when 5+ warning tags match.
- [ ] Profile pages:
  - [ ] Recent works are handled.
  - [ ] Recent series tags are handled.
  - [ ] Recent bookmarks tags are handled.
- [ ] Quick-add:
  - [ ] Hover button appears on AO3 tags.
  - [ ] Clicking `+` opens the menu for the correct tag.
  - [ ] Moving the cursor across nearby tags does not change the locked target.
  - [ ] Creating a rule updates the current page immediately.
- [ ] Popup:
  - [ ] Current page status is correct.
  - [ ] Global On / Paused toggle works.
  - [ ] Paused state disables tag hover quick-add visually and functionally.
  - [ ] Manage rules opens Options.
- [ ] Options:
  - [ ] Create / edit / delete / enable / pause rules.
  - [ ] Bulk delete selected rules.
  - [ ] Search and filters work.
  - [ ] Rule list scroll stays stable when opening the editor.
  - [ ] Language selector switches English / 简体中文.
  - [ ] Tag style presets update color inputs and previews.
- [ ] Persistence:
  - [ ] Refreshing AO3 keeps rules active.
  - [ ] Closing and reopening Chrome keeps rules/settings.

## Chrome Web Store listing prep

- [ ] Short description.
- [ ] Detailed description.
- [ ] Screenshots showing:
  - [ ] AO3 page with highlighted tags.
  - [ ] Warning / caution state.
  - [ ] Collapsed work state.
  - [ ] Options rule manager.
  - [ ] Popup summary.
- [ ] Store icon / promotional assets as needed by the Chrome Web Store dashboard.
- [ ] Category and language metadata.
- [ ] Support / contact destination if required.

## Privacy and permission notes

Use plain user-facing language in the Chrome Web Store privacy and permission forms.

- `storage`: used to save rules, UI settings, tag style settings, and language preference in the user's browser.
- `https://archiveofourown.org/*`: used only to read AO3 page tags and apply local visual changes on AO3 pages.
- No account system.
- No cloud sync.
- No analytics.
- No remote scraping.
- No data is sold or shared.

## Packaging steps

```sh
npm run build
npm run lint
npm run test
find dist -name .DS_Store -delete
cd dist
zip -r ../ao3-tag-highlighter-0.1.0.zip .
```

Then upload the zip through the Chrome Web Store developer dashboard.

## References

- Chrome Web Store publish guide: https://developer.chrome.com/docs/webstore/publish
- Chrome Web Store listing fields: https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- Chrome Web Store privacy fields: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
