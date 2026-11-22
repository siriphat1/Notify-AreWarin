# AreWarin Tutor OS — Supabase New Project v2.2

Ready-to-upload GitHub/Vercel **teacher Manager** edition. Uses the supplied NEW project `ihmiqtwclnqrezsnswfz` public URL/publishable key in `config.js`.

## Installation
Read `START_HERE_TH.md` first. For an empty NEW database, create a teacher user in Supabase Authentication then run `supabase/00_INSTALL_NEW_PROJECT_ONCE.sql` **once** after updating `v_owner_email`. For a new project that already had the original schema applied, use `supabase/02_ENABLE_APP_PASTE.sql` only.

## Files
- `index.html`, `style.css`, `app.js`, `config.js`: frontend Manager
- `supabase/00_INSTALL_NEW_PROJECT_ONCE.sql`: one-shot transaction containing foundation schema + permission and owner setup
- `supabase/01_SCHEMA_NEW_PROJECT.sql`: schema only, for manual 2-step setup
- `supabase/02_ENABLE_APP_PASTE.sql`: owner + permissions + attendance RPC

**This switches the website connection, not database rows from the old project.** LINE Login, LIFF, automated LINE messages, cron and student self-service are not ready in this edition.
