# AreWarin Tutor OS v2.6 — Student Portal

Files:
- `index.html`, `app.js`, `style.css` — teacher Manager
- `student.html`, `student.js`, `student.css` — student dashboard
- `config.js` — Supabase public URL/publishable key
- `supabase/01..03` — existing migrations (do not re-run if installed)
- `supabase/04_ENABLE_STUDENT_PORTAL.sql` — new migration for student login, invite, RLS, leave/renew requests
- `START_HERE_TH.md` — browser-only install guide

Important: Student login uses Supabase email/password + one-time invitation. LINE is not yet connected. The current package is not a substitute for production security/QA and notification backend testing.
