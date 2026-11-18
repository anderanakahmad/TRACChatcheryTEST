# Field mapping — TRACC Hatchery Datasheet (as provided, November 2026)

The reference workbook **Hatchery Datasheet.xlsx** is not included in this repository, and none of its actual nesting records were automatically published. Its `Turtle Hatchery 2026` sheet begins with grouped headers for relocation, sector, nest codes, expected dates, adult mother records, tag numbers, hatchling outcomes and excavation notes. The historical workbook also includes a masterlist, annual sheets 2019–2026, `Summary`, and separate scientific/monitoring datasets.

## Confirmed decisions for v3

1. **A nesting season is a calendar year.** Portal `season = YEAR(date_relocated)`. A record filed in the 2026 sheet but relocated in 2025 is assigned to **2025**, after the relocation date is verified. Do not use worksheet names as season labels.
2. **Released hatchlings include healthy and deformed.** A known `healthy_hatchlings + deformed_hatchlings` becomes the approved `released_hatchlings` count. Enter *both* numbers, with explicit `0` for a confirmed zero; missing categories remain unknown and are not silently treated as zero. Older independently approved release totals can be retained pending category reconciliation.
3. **Remove GPS from the website form.** Island sector is an editable public field, with generalized descriptions reviewed for visitor safety. Precise locations in the original workbook remain outside this public repository.
4. **Tag data can accompany a nest when the mother is identified.** A left or right tag is required for the optional public mother section. Adult carapace measurements and notes are shared only with that tag, by explicit staff choice and administrator approval. Otherwise the original information stays in protected research.
5. **Custom metadata can change per record.** Staff add/remove labeled fields and choose public/private visibility. Public changes take effect only after approval.

## 2026 sheet header → v3 portal field

| Original sheet header | Portal field | Publication rule / caveat |
|---|---|---|
| `Date:` | `date_relocated` | Staff must confirm this is the actual relocation date for the row. It determines calendar-year season. |
| `Turtle Sp.` | `species` | Green / Hawksbill / Olive ridley / other-unconfirmed, using verified taxonomic identity. |
| `Egg Count (Relocate)` | `egg_count` | Published after approval. |
| `Location:`, `Sector: Main`, `Sector: Mini` | `island_sector_found` (visitor summary), protected `nest_location` / `sector` | Generalized island sector, not raw GPS. Avoid precise nest-find locations or sensitive nesting zones. |
| `Nest Code:` | Protected `nest_code` | Not necessarily a globally unique portal ID. |
| `Relocate by: Nest`, `Relocate by: Hatchery` | Protected `relocated_by_nest`, `relocated_by_hatchery` | Public `warden_public_name` is a separate, consent-based display name. |
| `Expected:` | `expected_start` | Staff-estimated first emergence date. Optional estimated end date must be genuinely supported, not guessed. |
| `Excavate Date:` (planned) | Not automatically imported as actual excavation | Planning date is distinct from actual `excavation_date`. |
| `Hatching Date: Emergence` | `emergence_date` | Observed only. Missing markers like `-` are not dates. |
| `Hatching Date: Excavate` | `excavation_date` | Actual assessment date, if observed. |
| `Hatchling Count: Healthy`, `Deformed` | Protected `healthy_hatchlings`, `deformed_hatchlings`; published total `released_hatchlings` | Both categories count as released per TRACC instruction. Release total is known only when both counts are entered. |
| `Measurement (cm): CCL`, `CCW` | Protected `ccl`,`ccw`; optional public `mother_ccl_cm`,`mother_ccw_cm` | Public only with a visible tag and admin approval. |
| `Tag (if Have): Left`, `Right` | Protected `tag_left`,`tag_right`; optional public `mother_tag_left`,`mother_tag_right` | Publish only after explicit staff selection and approval; never invent tag numbers. |
| `GPS: Latitude`, `Longitude` | **Excluded from website field entry and public output** | Original workbook stays private. |
| `Hatching Date: Time`, `Method` | Protected research `hatching_time`, `hatching_method` | Not automatically published. |
| `Success Rate` | No direct portal rate import | Verify historical calculation before treating as egg-hatching success. |
| Broken / deformed eggs, undeveloped / dead eggs, attacked eggs, dead turtles, total excavated, difference | Protected research data | Not automatically published as visitor-facing fields. |
| `Note:`, `Notes:` | Public `notes_public` only by selection, otherwise protected `private_notes` | Public notes require editorial review. |

## Historical data preparation

- Use **annual records or the masterlist**, never both simultaneously.
- Match by a stable public nest ID assigned during review; original nest codes may repeat.
- Confirm dates stored as Excel serial dates are properly interpreted, including historical years and date inconsistencies.
- Reconcile egg counts, recorded hatchling categories, excavation and hatching totals before publishing annual statistics. **Do not fill missing released counts with 0.**
- Preserve original sheets privately, with backups and a record of any manual corrections.
- Only administrator-approved public fields should enter `public.nests` or `data/nests.json`. Protected research and pending requests must stay outside the public GitHub repository.
