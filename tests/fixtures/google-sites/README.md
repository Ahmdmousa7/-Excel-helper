# Google Sites fixtures

| File | What it is |
|---|---|
| `nightback-pages.json` | The 12 published pages of `https://sites.google.com/view/nightback` (6 English, 6 Arabic) as Jina returns them with `X-Return-Format: html`, captured 2026-10-01. **Reduced to what `utils/googleSites.ts` reads**: the `og:title` / `og:url` meta, the `<title>`, and the page's content `<section>` blocks with their `<p>`, `<span>`, `<a href>` and `<img src>` — every script, style, class and the site header/navigation dropped. `pages` is keyed by the page's path segment (`main-menu`, `hot-drinks`, `المشروبات-الساخنة`, …). |

Notes for test authors:

- `main-menu` is a hub: a logo, five category buttons (images linking to the English category pages), a promo photo, an offer banner, the offer as text (`Shisha + Tea + Water = 39 Riyal only`) and a "Back to the Arabic page" button.
- The menus are TEXT on the category pages. English edition: 103 items in 8 categories. Arabic edition: 107 items in 8 categories. The two editions are not translations of each other (different prices and items).
- The image URLs are Google's signed `sitesv-images-rt` links as captured; they are re-signed on every render, so tests never fetch them — browser tests answer them from a route, unit tests from a mock.
- No image bytes are stored: tests that exercise image reading use a generated placeholder and a mocked model answer.
