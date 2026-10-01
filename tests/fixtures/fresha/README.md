# Fresha fixtures

| File | What it is |
|---|---|
| `little-palm-spa-venue.html` | The public Fresha venue page for Little Palm Spa as Jina returns it with `X-Return-Format: html`, captured 2026-10-01. **Reduced to the menu fields `utils/freshaVenue.ts` reads**: venue name, then categories → services (`name`, `caption`, `retailPrice`, `formattedRetailPrice`, `variants`). Contact number, staff, owner, gallery and every other venue field were dropped. 9 categories, 67 services, 10 starting ("from") prices. |
| `booking-only-addons.example.json` | **Example only, never runtime data.** The 3 services seen only inside Fresha's booking flow during the investigation. The app cannot read them. Tests use this file to prove those names never appear in the app's output, which shows a note on a `Not on venue page` sheet instead. |
