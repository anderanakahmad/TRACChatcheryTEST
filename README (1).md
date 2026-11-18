# Public data only

- `demo-nests.json` contains **fictional** example records with fictional IDs, wardens, mother tags and optional public metadata.
- `nests.json` starts as `[]` and should only contain public records approved by TRACC. **Never** commit staff-only category counts, unpublished submissions, private research metadata, GPS positions, tagging data marked private, or the original hatchery workbook to a public repository.
- With live Supabase mode, `data/nests.json` is unused; protected research belongs in the database's restricted `nest_research` table.
- `season` is the **calendar year of relocation**, irrespective of the workbook sheet name.
- A `released_hatchlings` figure includes healthy + deformed hatchlings after both categories have been documented and approved.
- Mother tags and measurements are publicly shown only when deliberately shared for that nest after administrator approval.
