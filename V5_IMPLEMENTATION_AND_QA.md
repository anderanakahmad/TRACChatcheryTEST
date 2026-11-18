# Version 5 — Administrator review + practical QA checklist

## Approved workflow

1. Warden creates a new nest as Quick Entry or Detailed Entry. Submission is pending, not public.
2. Admin inspects public payload and protected research separately. Admin approves, rejects, or returns for correction with a reason.
3. Approved record becomes visible to visitors; audit entry records old/new snapshot and reviewer.
4. Warden may select any existing approved nest to submit an emergence, release or excavation **milestone**. The original relocation, species, egg count and mother tag identity are immutable from a warden milestone.
5. If returned, staff can revise and resubmit; new submission references prior returned submission and uses current version stamp. Admin must approve again.
6. Admin can propose full-record correction; no direct frontend edits to the published table.

## Database security validation before using real data

- [ ] Anonymous API can fetch approved `public.nests` only; can't read `staff_profiles`, `nest_research`, `nest_submissions` or `nest_audit`.
- [ ] Warden Auth `SELECT nest_research` and `SELECT nest_audit` return zero rows or 403; private research is **not fetched** by the warden staff page.
- [ ] Warden can only SELECT submissions submitted by them; cannot SELECT submissions of other users.
- [ ] Warden can INSERT `new_nest` for unused ID or `milestone` for an approved ID; cannot create `correction` or directly UPDATE/DELETE `nests`.
- [ ] Warden cannot call `tracc_decide_submission` and cannot change request state/reviewer columns.
- [ ] Administrator can review. Approval always preserves prior public record until review completes.
- [ ] Return for correction requires a note; new submission can link only to same user's returned request for same nest.
- [ ] Approval must reject milestone `egg_count`, `species`, mother tag, `id`, relocation date or arbitrary JSON keys.
- [ ] Review detects stale base version and prevents overwriting a more recent approved record.
- [ ] Audit details/snapshots visible to admins only; every approval logged.
- [ ] Live Excel exports of protected research and submissions usable by admins only.
- [ ] Verify SQL on a **fresh** test project, including `SECURITY DEFINER` privilege and default grants.
- [ ] Backup, auth revocation, 2FA, TLS, and field phone loss procedures tested.

## Field & visitor QA

- [ ] Test offline encrypted draft on HTTPS/localhost. Confirm wrong passphrase fails, plaintext isn't stored, restore works, delete works and browser device reset loses it.
- [ ] Test the same draft when a different staff account signs in (must reject).
- [ ] Verify quick entry requires essential relocation details; detailed fields accessible in Detailed Entry.
- [ ] Test 0, blank and positive healthy/deformed release fields, and audit after review.
- [ ] Confirm **Emerged** and **Excavated** aren't confused; excavation date required for Excavated.
- [ ] Confirm calendar-year trends and species filters still match approved records.
- [ ] Open generated public nest QR on a second device; verify no internal identifiers or private API paths in link.
- [ ] Verify followed-nest filter persists on same device and doesn't imply email notifications.
- [ ] Proofread Bahasa Melayu translations with TRACC staff; some narrative content is English in v5.
- [ ] Verify heading/layout/contrast, long mobile forms, screen reader names, and 360px viewport on actual devices.
- [ ] Insert the commissioned turtle/status illustrations only after final artwork is delivered.
