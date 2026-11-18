# TRACC Hatchery Portal — Version 6 notes

**Status:** Demonstration-only website and staff editor. No live authenticated database or verified production deployment. Public demo nests are invented; the original TRACC workbook is not included in the repository.

## 1. Egg counts during relocation

The 2026 and 2025 worksheets of the provided Hatchery Datasheet distinguish `Egg Count (Relocate)` from the `Egg: Broken` and `Egg: Deformed` columns. These are separate **egg** categories and must never be conflated with the later `Hatchling Count: Healthy` / `Deformed` values.

| Warden form | Stored key | Storage location after approval | Public display |
|---|---|---|---|
| Eggs relocated | `egg_count` | Public approved nest record | Yes, on nest card, nest details and stats |
| Broken eggs | `broken_eggs` | **Protected** nest research JSON | **No** |
| Deformed eggs | `deformed_eggs` | **Protected** nest research JSON | **No** |

All three inputs appear in **Quick Entry and Detailed Entry**. Relocated eggs is required; broken/deformed counts may be blank (unknown) or 0 (confirmed none). The system does not sum these three categories because the field protocol may treat egg categories differently. Record them exactly as documented in the source sheet. Administrators can revise original relocation counts using reviewed corrections; wardens cannot replace these counts via follow-up milestones.

New validation prevents accidentally publishing the protected egg categories as custom public metadata by their names. However, reviewers still need to check narrative notes and any other free-text fields for unintended disclosure.

## 2. Derived public nest phase

The database stores verified, approved `status` values **Incubating**, **Emerged** and **Excavated**. The public website additionally derives the following labels for uncompleted nests:

| Days after relocation | Public label | What it means |
|---|---|---|
| 0–49 | **Incubating** | No emergence or excavation has been reported |
| 50–60 inclusive | **Emergence Soon** | Within TRACC's configured calendar-based observation window, **not confirmation of hatching** |
| 61+ | **Awaiting update** | No confirmed result published after the estimated window; prompts monitoring follow-up |
| Any date with approved Emerged / Excavated | **Emerged** / **Excavated** | Verified field observation takes priority over a date estimate |

Days are counted from **relocation date**, not from any independently known laying date, as requested. This is an interface phase indicator, not the scientifically measured incubation duration or a biological prediction. An administrator may need to revise the dates/windows as biological context warrants. Users can filter by this displayed phase, and the **Emerging Soon** sorting mode prioritizes nests in that window. The new phase's icon can be replaced with TRACC's commissioned illustration by setting `STATUS_ICONS.emergence_soon` in `assets/config.js`; an additional icon placeholder is available for `awaiting_update`.

The visitor never sees broken/deformed eggs in the core nest record or statistics. The total number of released **hatchlings** continues to equal healthy + deformed released hatchlings when both counts are reported.

## 3. Light and dark modes

A **Dark / Light** toggle appears in both the visitor and staff headers. The theme is shared between both pages and saved on that browser (`localStorage` key `tracc_theme`). When there is no saved preference, it follows the operating system's color setting. Theme preference is *not* account-bound or synchronized between devices.

Design settings are owned entirely by editable HTML/CSS/vanilla JavaScript; no build tool is required. The TRACC brand colors and logos remain unchanged.

## 4. Safety before production

- `database/schema.sql` is a **fresh-install** SQL design, not a migration to an existing Supabase project. Role-based access policies and the approval function **still require live permission tests** with real warden/admin users before importing confidential records.
- The public page still uses fictional demo nests. Do **not** push unreviewed spreadsheets, research JSON, secrets, detailed tagging data or unapproved private metadata to GitHub Pages.
- Use the administrator approval queue before any record becomes publicly visible. Validate season and protected egg fields for each imported nest.
- `Emergence Soon` is an estimated **phase**, not a request to release hatchlings, conduct excavation, or assume the nest has hatched. TRACC field protocols always govern physical activity.
- Staff should confirm whether broken/deformed egg fields are treated as additive or nonadditive with relocated egg counts in all years before designing further automatic totals.
- Dark-mode visual QA was not completed in a real browser in this environment. Do cross-browser/mobile review and accessibility/contrast checks before launch.

## 5. Automated checks

Run `node tests/v6_phase_eggs_theme.mjs` and the other `.mjs` scripts in `tests/`. Tests cover the 49/50/60/61 day boundaries, confirmed event precedence, separation of protected egg fields, and the presence of theme controls. Passing tests are **not a substitute for** live authorization or full visual QA.
