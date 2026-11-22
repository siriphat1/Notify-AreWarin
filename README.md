# AreWarin Tutor OS — Supabase Connected Manager

Static website, ready for GitHub upload and Vercel deploy (Framework: Other). Uses the public Supabase URL and publishable key from `config.js`; no server secret keys required for this manager phase. Requires the previously run `schema.sql`, followed by `supabase/02_ENABLE_APP_PASTE.sql` to assign the owner and activate RLS write policies + atomic attendance RPC.

- `index.html`, `style.css`, `app.js`, `config.js`: live manager frontend
- `supabase/02_ENABLE_APP_PASTE.sql`: setup migration (change owner email!)
- `START_HERE_TH.md`: no-terminal Thai deployment guide

Student LINE login, messaging, scheduled CRON delivery, and parent portal have **not** been implemented in this release.
