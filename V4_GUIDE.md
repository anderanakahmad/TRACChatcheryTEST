# TRACC Hatchery Portal — v4 feature and data guide

## Visitor website

- **Navigation**: Hatchery impact → `#impact` statistics and relocation trend; Explore nests → `#nests` filters and grid/list; Our work → `#our-work` conservation; How it works → `#how-it-works` lifecycle and interpretation. The **TRACC header logo** opens `https://tracc.org/` (destination configurable in `assets/config.js`).
- **Nest status options**: Incubating, Excavated, Emerged. The older **Hatched** status from v3 is no longer an accepted selection. Do not automatically map historical “Hatched” records to “Emerged”: verify the observation with wardens before migration. An Excavated record needs an excavation date.
- **Nest card outcomes**: Public cards display eggs relocated for all records and a distinct hatchlings-released count only when a **positive** approved release count is recorded on an Emerged or Excavated nest. Zero and unreported counts do not produce a separate badge. Nest details retain their more complete outcome information.
- **Sort**: Latest relocated (descending relocation date); Emerging soon (incubating nests with an estimated start date, earliest first; then incubating without estimates; completed nests last). Estimated start is a **forecast**, not an observed hatch.
- **Recent milestones**: Four latest dated events derived from **administrator-approved** records: relocated, first emergence observed, excavated. Dates are shown explicitly. No fabricated “this week” counts or automatic biological status predictions.
- **Sector map**: Original user-supplied Pom Pom sector image shown in a polished panel, without modifying its boundaries. “View sector on map” in a nest dialog scrolls to the map and displays the chosen **general sector label**, not a pinpoint. Wardens can enter labelled sectors A1–G2 with optional free-text legacy names. Do not publish GPS, exact nest locations, or sensitive scientific data.
- **Future art**: `assets/config.js` supports `HERO_ART_URL` and `STATUS_ICONS` to substitute a community turtle illustration and three status icons when supplied. Until then, the existing SVG hero and compact status symbols remain. Icons and illustration images should be original/authorized TRACC assets.

## Staff Excel exports

The staff portal's new export section produces a **real `.xlsx` file** with a self-contained native JavaScript Office Open XML writer (`assets/xlsx-export.js`; no Excel or SheetJS service needed). Available selections:

1. All approved nest records.
2. Approved records by calendar year (based on relocation date).
3. Approved records by species.
4. One approved nest.
5. All review submissions (**administrator only**), including their unapproved public proposals and protected research JSON.

Approved exports contain a **first sheet** with standard approved nest fields, plus separate columns for optional *public* metadata labels. Administrators can tick **Include protected research fields** to add a separate research sheet. Wardens/editors can download approved public data only. **All review submissions and all research data are sensitive**; do not upload these workbooks or request JSON to a public GitHub repo.

In `demo` or `json` mode, admin-only controls are available as a **local simulation** to test them; they are **not secure staff sign-in**. In live `supabase` mode, only a verified `admin` profile can use those options; Supabase RLS must protect the source tables. Actual downloads use only records the authenticated role can read. Staff should separately keep original Excel and offline field forms as primary archive/backups.

The browser-only writer uses native ZIP STORE compression (files are larger than compressed `.xlsx` but valid). Dates are exported as ISO date strings for a consistent calendar-year basis. Text values are always written as **strings**, preventing spreadsheet formulas from being executed automatically if untrusted notes begin with an equals sign. Scientific records should still undergo quality review.

## Security and launch

- `DATA_SOURCE: 'demo'` remains the default and displays **six fictional records**. TRACC's actual historical workbook is **not bundled**.
- Online approval/authentication is **not functional** until Supabase is configured using `database/schema.sql`, staff accounts added, and live RLS/security checks passed. `schema.sql` describes a **fresh installation**, not an automatic migration from a previous database.
- No browser-side measure fully prevents scraping or copying public data; the disclaimer is a legal/ethical notice, not access control.
- Share mother tag information only if approved, and verify whether even generalized sectors are permissible for public display.

## When the commissioned artist finishes

1. Place the artwork in `assets/illustrations/`, for example `community-turtle.png`, `incubating.png`, `emerged.png`, and `excavated.png` (PNG or WebP, ideally transparent backgrounds).
2. Edit `assets/config.js`:

   ```js
   HERO_ART_URL: './assets/illustrations/community-turtle.png',
   STATUS_ICONS: {
     incubating: './assets/illustrations/incubating.png',
     emerged: './assets/illustrations/emerged.png',
     excavated: './assets/illustrations/excavated.png'
   },
   ```

3. Refresh and check mobile/desktop alignment. Replace paths as needed; no HTML or JavaScript rewrite required.

## Tests

```bash
node tests/dashboard_smoke.mjs
node tests/admin_smoke.mjs
node tests/xlsx_smoke.mjs
```

These cover functional logic, not fully authenticated role security or live-browser visual checks. Full browser and Supabase integration acceptance is required before publishing real data.
