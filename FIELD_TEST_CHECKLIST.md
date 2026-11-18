# TRACC warden mobile test checklist

Test on at least one Android phone and one iPhone if available; both dark and light themes.

- Open visitor portal; check navigation, Nest Explorer, statistics, nest detail, QR code, sector map.
- Open `admin.html?role=warden` and check one-handed use on the beach or boat.
- Quick Entry: fake ID TEST-2026-001; 100 relocated, 3 broken, 2 deformed eggs (must not sum to 105).
- Detailed Entry: verify optional fields and note clarity.
- Tap Save encrypted draft; leave page and restore; explain loss risks.
- Submit fake request; check filename and verify public nest is **not** changed before approval.
- Transfer JSON to admin on separate device and import to `admin.html`. Note changes stay local to that admin device.
- Approve, return for correction, reject; check audit and local public visibility.
- Warden selects a demo approved nest; can submit follow-up milestone only, not alter relocation counts.
- Test required fields, duplicate IDs, empty egg counts, future dates, invalid release status.
- Check offline behavior: previously loaded page may not function offline unless browser caching exists; there is **no offline sync**.
- Count taps, time needed, and misclicks; photograph UI only with fiction.
- Collect staff feedback and rate ease of use 1-5.

**Security**: public site and repo contain fictional data; no login required. Never assume a GitHub Pages URL, QR code or hidden button protects records.
