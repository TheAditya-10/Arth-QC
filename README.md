# Arth-QC

AI-powered homework assessment, practice and progress tracking for a Class 6 student, with a parent console for families who live apart.

- **Phase 1** built the student and parent frontend.
- **Phase 2** (this version) adds the production backend: Neon Postgres, Better Auth, Gemini evaluation, private Cloudflare R2 uploads, Resend email and Vercel Cron.

The Phase 1 UI is unchanged in design. Screens now read and write real data through authorised API routes.

---

## Architecture

The app is a modular monolith on Next.js (App Router). It has no separate backend service, queue server or Redis.

```
Browser ──► src/lib/client/*   (typed API client + cache, same `useStore` API the Phase 1 UI used)
              │ fetch
              ▼
         src/app/api/**/route.ts       thin handlers: Zod-validate → authorise → call a service
              ▼
         src/lib/services/*            business logic (transactions, idempotency, scoring rules)
         src/lib/ai/*                  Gemini engine (replaceable provider, prompts, schemas)
         src/lib/math/exact.ts         deterministic BigInt-rational verifier
         src/lib/storage/*             R2 presigned uploads (local driver for dev)
         src/lib/email/*               Resend client + HTML templates
              ▼
         src/lib/db (Drizzle)  ──►  Neon Postgres
```

| Folder | Responsibility |
|---|---|
| `src/lib/db/schema/*` | 47 tables: auth, families, academics, submissions/evaluations, learning, gamification, reports, operational |
| `src/lib/db/migrations` | Drizzle Kit SQL migrations (incl. CHECK constraints and partial unique indexes) |
| `src/lib/auth` | Better Auth config: parent email/password, student username + PIN, lockout hooks, DB rate limits |
| `src/lib/security` | Actor resolution from the session, family/student guards, route wrapper (errors + Origin check), DB rate limiter, cron auth |
| `src/lib/services` | account, assignment, submission, evaluation (job queue + pipeline), practice, gamification, progress (mastery), reward, report, buddy, dashboard, state |
| `src/lib/ai` | `gemini.client.ts`, `mock.provider.ts`, `extraction`, `rubric`, `evaluation`, `feedback`, `practice-generator`, `prompts/`, `schemas/` |
| `src/app/api` | Route handlers (see API list below) and `cron/*` workers |
| `scripts/seed.ts` | Reference data and an optional demo family |
| `tests/unit`, `tests/integration` | Vitest suites (47 unit tests, 6 Postgres integration tests) |

### Evaluation pipeline

1. The student picks pages. For each file the browser asks `POST /api/uploads` for a presigned URL. The server checks the student's permission, the MIME type and the size, and generates an opaque key.
2. The browser uploads the file directly to private R2.
3. `POST /api/uploads/:id/complete` re-checks the stored size and the file's signature bytes. A renamed file is rejected and deleted.
4. `POST /api/submissions` (with an idempotency key) saves the submission and its files and creates **one** `evaluation_jobs` row. The job key is `submissionId:v1`. The handler responds immediately.
5. The job is run by `after()` once the response is sent. If that instance dies, the cron sweeper and the status polling pick it up instead. Jobs are claimed with `FOR UPDATE SKIP LOCKED`, and stale locks are reclaimed after 10 minutes.
6. Stages: `EXTRACTING → EVALUATING → COMPLETED | NEEDS_REVIEW | FAILED`.
   - **Extraction:** a multimodal Gemini call. Unreadable work is flagged, never guessed.
   - **Rubric:** a parent rubric wins. Otherwise one is generated and must sum to the question's maximum marks, with a safe fallback.
   - **Grading:** step-wise marks. Responses are rejected if marks exceed a maximum, totals are inconsistent, or questions are missing or unknown. A rejected response is retried once with the errors listed.
   - **Deterministic verification:** exact BigInt-rational arithmetic checks the final answer and each written step. If it disagrees with Gemini, the evaluation goes to **NEEDS_REVIEW**; neither side is accepted blindly.
   - **Feedback:** child-friendly explanations, with a fallback if feedback generation fails.
7. The final per-question results are validated with a Zod schema. They are then stored in one transaction together with the steps, the mistake notebook, XP, streak, topic mastery and achievements.
8. Transient AI errors retry with exponential backoff, and quota exhaustion waits until later. After 4 attempts the job is `FAILED`, and parents can retry or re-evaluate it as a new version.

AI marks (`ai_marks`, `ai_score`) are never overwritten. Parent corrections go into `evaluation_corrections` with a required reason, giving a full audit trail. The model name and prompt version are stored on every evaluation and rubric.

### Gamification and learning intelligence

- **XP** is an append-only ledger (`xp_transactions`). A unique key on (student, rule, source) makes every award idempotent, and homework XP is keyed by assignment, so resubmitting never pays twice. The rules are configurable per family (`families.xp_rules`).
- **Streaks** count only qualifying activities (homework, practice, corrected mistakes, revision). Days are taken in the family's timezone (default `Asia/Kolkata`). A failed request never resets a streak.
- **Achievements** unlock on the server from computed metrics, each paying its XP once.
- **Topic mastery** blends recent scores, weighted by recency, with a confidence factor based on attempts. One score can never mean "Mastered". Levels are Not Started, Learning, Improving, Proficient and Mastered.
- **Recommendations** are explainable: each comes with a reason such as "accuracy is 45% (below 60%); 3 repeated calculation mistakes". Difficulty rises gradually as accuracy improves. Weak topics drive the AI practice generator.
- **Rewards** are parent-defined (XP, streak, score, improvement or custom). The student requests an unlocked reward; the parent approves and then marks it delivered. Delivery is never automatic.

---

## Security model

- **Roles come from the database, never from the browser.** Every protected handler calls `requireParent()`, `requireStudent()` or `requireActor()`. Student data goes through `assertStudentAccess`: a student may only reach their own data, and a parent only students linked to them in their family. Unauthorised IDs return 404.
- Students never receive answer keys, parent email addresses or internal error details. Practice answers stay on the server until the question has been answered.
- **Parents** sign in with email and password (min 10 characters, a letter and a number). **Students** sign in with a username and a 6–8 digit PIN, and their accounts can only be created by a parent.
- **Login protection:**
  - Better Auth's database-backed rate limit allows 5 sign-ins per minute per IP.
  - Accounts lock for 15 minutes after 5 bad PINs (students) or 8 bad passwords (parents). The lock is enforced in Better Auth hooks.
- **Sessions:** HTTP-only, SameSite=Lax, `Secure` in production, 7-day expiry with daily rolling refresh.
- **CSRF:** Better Auth checks the origin of its own routes. Our state-changing routes require a same-origin `Origin` header.
- **Invitations:** a 32-byte token is emailed and only its SHA-256 hash is stored. Tokens expire after 7 days, and the invitee must hold the invited email address.
- **Storage:** private bucket and opaque keys. Uploads are presigned PUTs with a signed `Content-Length`, and downloads are 10-minute presigned GETs. Files are checked by magic bytes. Abandoned uploads are purged after 24 hours, and deleted submissions have their files removed.
- **AI Buddy:** hint-first system prompt, strict safety settings, emails and phone numbers redacted before storage or model calls, hourly and daily limits, and 30-day chat retention.
- **Hosting safeguards:** cron endpoints need `Authorization: Bearer $CRON_SECRET` (constant-time compare). Security headers are set (HSTS, nosniff, frame-deny, referrer, permissions). Secrets exist only in server environment variables.
- **Production guards:** the mock AI provider and the local storage driver both refuse to run when `NODE_ENV=production`.

---

## Local development

Requires Node 18.18+ (22 recommended) and any Postgres 14+.

```bash
npm install
cp .env.example .env.local          # then fill in the values below
#   DATABASE_URL=postgres://localhost/arthqc
#   BETTER_AUTH_SECRET=$(openssl rand -base64 32)
#   APP_URL=http://localhost:3000
#   AI_PROVIDER=mock        # or gemini + GEMINI_API_KEY
#   STORAGE_DRIVER=local    # or r2 + R2_* keys
cp .env.local .env                  # drizzle-kit and scripts read .env
npm run db:migrate                  # apply migrations
npm run db:seed:demo                # reference data + demo family (or `npm run db:seed` for reference data only)
npm run dev
```

The demo logins are printed by the seed:

- **Parent:** `priya.parent@example.com` / `ArthQC-demo-2026`. The second parent is `rahul.parent@example.com`.
- **Student:** username `ananya`, PIN `246810`.

Change these with `DEMO_*` env vars.

Without `RESEND_API_KEY`, emails are logged as `SKIPPED`. For invitations the app shows a shareable link instead. With `AI_PROVIDER=mock`, a deterministic offline provider simulates transcription and grading so the whole pipeline can be exercised; it cannot read real handwriting.

### Scripts

| Command | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `npm test` | Unit tests (verifier, grading validation, mastery, streaks, XP rules, timezones, file sniffing, PII redaction) |
| `TEST_DATABASE_URL=… npm run test:integration` | Postgres tests: idempotent XP under concurrency, no duplicate jobs, single-worker claiming, full pipeline, family isolation |
| `npm run db:generate` | Generate a migration after schema changes |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` / `db:seed:demo` | Seed reference data / plus a demo family |

---

## Production setup

### 1. Neon

1. Create a Neon project (region near your users, e.g. Singapore for India).
2. Copy the **pooled** connection string into `DATABASE_URL`. The app uses Neon's WebSocket pool driver automatically for `*.neon.tech`, which supports transactions.
3. From your machine, run `DATABASE_URL=… npm run db:migrate && DATABASE_URL=… npm run db:seed`. Use `db:seed:demo` only if you want sample data.

### 2. Better Auth

Set `BETTER_AUTH_SECRET` (32+ random characters) and `APP_URL` to the production URL.

### 3. Google Gemini

1. Create an API key in Google AI Studio and set `GEMINI_API_KEY`, with `AI_PROVIDER=gemini`.
2. Models are set by environment variable (`GEMINI_MODEL_EXTRACTION`, `GEMINI_MODEL_EVALUATION`, `GEMINI_MODEL_FAST`), so you can upgrade without code changes.
3. The free tier has low rate limits. Rate-limit and quota errors are retried with backoff and never lose a submission. Every call is logged in `ai_usage_logs` with latency and token counts.

### 4. Cloudflare R2

1. Create a **private** bucket (no public access, no r2.dev URL).
2. Create an API token with *Object Read & Write* on that bucket, then set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` and `STORAGE_DRIVER=r2`.
3. Add a CORS policy so browsers can PUT directly:

   ```json
   [{ "AllowedOrigins": ["https://your-app.vercel.app"], "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```

### 4b. Or: store files in Postgres (no R2)

Set `STORAGE_DRIVER=db` (the default in production when no R2 bucket is configured). Uploads are stored as `bytea` in `stored_objects` behind the same short-lived signed URLs. Files are capped at 4 MB each (Vercel's request limit); large phone photos are downscaled in the browser first. Suitable for a single family on Neon's free tier.

### 5. Email: SMTP or Resend

With `SMTP_HOST` set, email goes over SMTP (`SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `EMAIL_FROM`); otherwise Resend is used.

For Resend:

Verify your sending domain, then set `RESEND_API_KEY` and `EMAIL_FROM`. Every send is recorded in `email_delivery_logs`. Weekly reports are unique per (student, week) and per recipient, so cron retries never double-send. Failed deliveries can be retried from the Reports page or by cron.

### 6. Vercel

1. Import the repository. The framework is detected as Next.js. The build command `npm run vercel-build` runs migrations and the reference seed before `next build`. `vercel.json` pins functions to `sin1` (Singapore) next to the database.
2. Add all environment variables from `.env.example`, including a random `CRON_SECRET`.
3. Deploy. `vercel.json` registers two Hobby-compatible daily crons:
   - `/api/cron/reports` runs at 13:30 UTC (19:00 IST). It generates and emails reports for families whose scheduled day and time has passed, then retries failed deliveries.
   - `/api/cron/maintenance` runs daily. It sweeps queued and stale evaluation jobs, purges abandoned uploads, enforces chat retention, and clears expired sessions and rate-limit rows.
4. **On Vercel Pro**, make it more responsive by adding `{ "path": "/api/cron/evaluations", "schedule": "*/5 * * * *" }` and changing the reports schedule to hourly (`"0 * * * *"`). Report times are then honoured to the hour in each family's timezone. On Hobby, reports go out at the 19:00 IST run on each family's chosen day.

Evaluations do **not** depend on cron. `after()` runs them right after submission, and the processing screen's status polling nudges any job that was interrupted.

---

## API (route handlers)

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/sign-in/email`, `/sign-in/username`, `/sign-out` (Better Auth) · `POST /api/auth-flow/register` · `GET/POST /api/invitations/:token` |
| Family | `GET/POST /api/family/invitations`, `DELETE /api/family/invitations/:id` · `GET/POST /api/students`, `POST /api/students/:id/pin` |
| Data | `GET /api/state?studentId=` (authorised snapshot for all screens) · `GET /api/progress/summary` (parent aggregates) |
| Assignments | `POST /api/assignments`, `PUT/DELETE /api/assignments/:id`, `POST /api/assignments/:id/start`, `POST /api/assignments/generate` (Gemini draft) |
| Uploads | `POST /api/uploads`, `POST /api/uploads/:id/complete` |
| Submissions | `POST /api/submissions` · `GET /api/submissions/:id/status` · `POST /api/submissions/:id/corrections` · `POST /api/submissions/:id/retry` · `DELETE /api/submissions/:id` |
| Practice | `POST /api/practice/sessions` · `POST /api/practice/sessions/:id/answers/:questionId` · `POST /api/practice/sessions/:id/complete` · `DELETE /api/practice/sessions/:id` |
| AI Buddy | `GET/POST/DELETE /api/buddy/messages` |
| Rewards | `POST /api/rewards`, `PUT/DELETE /api/rewards/:id`, `POST /api/rewards/:id/redeem`, `POST /api/rewards/:id/decision` · `POST /api/achievements/celebrated` |
| Reports | `POST /api/reports/test`, `POST /api/reports/:id/retry`, `PATCH /api/reports/settings` |
| Settings | `PATCH /api/settings/student`, `/parent`, `/notifications`, `/app` |
| Cron | `GET /api/cron/evaluations`, `/reports`, `/maintenance` (Bearer `CRON_SECRET`) |

Every input is validated with Zod. Errors return `{ error: { code, message, details? } }` with the matching HTTP status.

---

## Known limitations

- Science and English are modelled (subjects and topics tables) but disabled. The practice question bank and topics are seeded for Class 6 Mathematics only.
- In-app notifications are limited to the dashboard and email; there is no push. The notification preferences are stored for when notifications are added.
- Parents can't reset a forgotten password by email yet; Better Auth's reset endpoints are disabled until an email template is added. A parent can reset a student's PIN.
- On Vercel Hobby, scheduled work runs at most daily (see above). Evaluations themselves are immediate.
- Deterministic verification covers numeric answers and arithmetic steps: integers, decimals, fractions, mixed numbers, percentages, +−×÷ and "of". Word answers are judged by Gemini, and borderline cases are flagged for review.
