# TRACC Hatchery Portal — field-test demonstration

**TEST MODE. All data is fictional. Do NOT enter current or historical TRACC nest records, actual staff names, tag numbers, coordinates, or confidential information.**

Static HTML5/CSS3/vanilla-JavaScript site suitable for GitHub Pages. It is a faithful public/staff UI prototype derived from the v6 portal, with a local device test layer. This is **not** a secure operational warden application.

## URLs after GitHub Pages is enabled
- `/` or `/index.html`: demo visitor portal
- `/admin.html?role=warden`: demo warden mobile interface
- `/admin.html`: demo administrator review screen
- `/testing.html`: structured field-test steps and downloadable feedback

## How testing works without Supabase
- Demonstration data live in `data/demo-nests.json` and browser-local test state.
- New nests/milestones become **demo-only** requests and generate review-request JSON downloads.
- Administrators can import the file on a **different device** for a manual approval simulation. Changes are only saved **in the administrator's browser**, not shared across devices.
- On the **same browser**, submissions and approvals can persist in localStorage (for convenience only; anyone with browser access can change them). The public visitor page can show approved demo changes on that device.
- All fake requests can be cleared with Reset demo data on the staff screen. Drafts saved with a passphrase have their own separate Delete draft action.
- No user authentication, access controls or backend exist in this test build. `?role=warden` is merely a UI preview, not security.

## Egg count definitions
Relocated eggs exclude broken eggs and deformed eggs. Those are three distinct entry fields and **must never be summed** into public relocated egg counts. Only relocated eggs appear on the visitor pages. Healthy + deformed **hatchlings released** are both part of the released hatchlings count.

## How to publish
For this public repository, use Settings > Pages > Build and deployment > Deploy from a branch > `main` > `/ (root)` > Save. The resulting project site is `https://anderanakahmad.github.io/TRACChatcheryTEST/` after GitHub reports successful deployment.

## What to test on phones
See `testing.html` and `docs/FIELD_TEST_CHECKLIST.md`. Focus on clarity, speed, contrast, touch targets, form errors, drafts, nest phase labels and the JSON handoff to administrators. Do not test with genuine records.

## Future work (not implemented)
Controlled staff authentication, real account roles, secure approvals, Supabase Row Level Security, synchronized records, controlled research exports, privacy/security reviews and backups. Add commissioned TRACC turtle/status artwork after fieldwork feedback.
