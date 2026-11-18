# AreWarin Tutor OS — Firebase Edition (v2.0)

Modern Bento Grid tutoring management site, adapted from v1.3. Client-side teacher login uses Firebase Auth; all private data reads/writes and LINE actions use Vercel Node Functions with Firebase Admin SDK. Students authenticate via LINE LIFF ID tokens, verified server-side with LINE. Data lives in Firestore.

**No terminal or localhost needed for deployment.** Upload root contents to GitHub through browser → Import on Vercel → set Firebase/LINE environment variables and `config.js` through web UIs.

See [INSTALL_TH.md](INSTALL_TH.md) for a complete Thai step-by-step guide.

## Entry points

- `/` / `index.html` — teacher admin Manager (Firebase email/password, exact `ADMIN_UID` enforced in API)
- `/student.html` — student portal (LINE LIFF + activation code)
- `/api/data` — authorized teacher data GET/PUT (revision guard)
- `/api/activation` — admin-only one-time invitation code
- `/api/link` — securely verify LINE ID token and exchange activation code
- `/api/student` — student-owned reads and self-service leave/renew/stop requests
- `/api/cron` — authenticated due-reminder engine (1 day/1 hour)

## Important security constraints

- **Never upload** Firebase Service Account JSON or LINE Channel Access Token to GitHub. Keep them only in Vercel Environment Variables.
- `config.js` is public and must include **only** web config and LIFF ID.
- Firestore security rules must be deny-all for browsers (`firestore.rules`). Server access is only via Firebase Admin SDK.
- The LINE ID token is verified by LINE servers, not trusted merely as user-supplied `lineUserId`.
- New LINE activation codes are cryptographically random, one-time, and valid 7 days. Send privately.
- Teacher access is restricted to Firebase Auth UID matching `ADMIN_UID` in Vercel.

## Known limitations

- Uses one revisioned Firestore data document for backwards compatibility; not suitable for multi-school/high-concurrency production without collection-wise migration.
- Recurring automatic notifications require a frequent external scheduler. Pro Cron example included; Hobby default `vercel.json` has no Cron and therefore won't automatically send timed notifications.
- Student and teacher actions share the same revisioned state; teacher must reload after student submits a request to avoid conflicts.
- Do not use for real student financial data until you complete a privacy, permissions and audit review.

## Official references

- https://firebase.google.com/docs/web/setup
- https://firebase.google.com/docs/admin/setup
- https://firebase.google.com/docs/firestore/security/get-started
- https://developers.line.biz/en/docs/liff/registering-liff-apps/
- https://developers.line.biz/en/docs/line-login/verify-id-token/
- https://vercel.com/docs/functions
