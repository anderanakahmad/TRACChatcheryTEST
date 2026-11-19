# TRACC Hatchery Portal — Fictional Field Test

**TEST ONLY — do not enter real turtle nesting records, staff personal details, tag numbers, research notes or GPS coordinates.** This repository is a visitor/staff interface prototype hosted on GitHub Pages. There is **no shared database, authentication or secure staff access**.

## Test pages

- [Visitor portal](https://anderanakahmad.github.io/TRACChatcheryTEST/)
- [Warden form (simulated role)](https://anderanakahmad.github.io/TRACChatcheryTEST/admin.html?role=warden)
- [Administrator review (simulated role)](https://anderanakahmad.github.io/TRACChatcheryTEST/admin.html)
- [Field test guide](https://anderanakahmad.github.io/TRACChatcheryTEST/testing.html)

## Why a new warden record is not visible immediately

1. Enter a **fictional** nest in the warden form and submit it.
2. The nest goes into a **pending** review request; submitting does **not** publish it.
3. On **the same device, in the same browser**, open the administrator page and approve the pending request.
4. Refresh the visitor portal in the same browser. The approved fictional nest should appear.
5. **Different phones do not share local demo data.** For testing a warden-to-admin handoff on different devices, send the downloaded request JSON file privately to the admin; the admin imports it and simulates approval in their browser. Other visitors still cannot see that approval automatically.

On GitHub Pages, `assets/config.js` currently uses `DATA_SOURCE: 'demo'`. The six example nests are read from `data/demo-nests.json`. Local browser submissions are held in `localStorage`; they are not sent to GitHub or any backend.

For a *manual* shared public demonstration without a live database, an administrator would need to export **approved public-only** JSON, commit it as `data/nests.json`, and change `DATA_SOURCE` to `json`. **Never put review-request files, unpublished fields, staff-only data or protected research data in this public GitHub repository.**

## Official field-test limits

This demo can test mobile layout, validation, entry modes, the simulated approval flow, phases, light/dark mode, QR codes, filters and Excel export. It **cannot** test real secure user roles, automatic cross-device synchronization, private database permissions, live approvals, or production data security.

The relocation egg-count rule is: relocated eggs **exclude** broken and deformed eggs. Healthy and deformed **released hatchlings** both count toward release totals when documented.

See `testing.html` or `docs/FIELD_TEST_CHECKLIST.md` for the testing checklist.

## Excavation outcomes (field-test update)

The seven categories are Hatchlings (live recovered and released), Undeveloped, Stage 1, Stage 2, Stage 3, Dead Turtle (dead hatchlings found in the nest), Unsure. Count dead embryos still in eggs by stage. Counts are separate from relocation egg counts. Total released = cumulative healthy + deformed pre-excavation releases + live recovered hatchlings released. The fictional staff breakdown is seeded from `data/demo-excavation.json` for the admin demo, not included in public nest cards. As this is a public repository, these fictional breakdowns are not security-protected; never store genuine excavation data here. Live Supabase schema and validation must be updated and tested before production use.
