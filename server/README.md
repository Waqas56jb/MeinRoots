# MeinRoots — API

Candidate platform and AI qualification engine for Milestone 1. Node.js + Express +
PostgreSQL, no ORM, no build step.

## What it does

A candidate registers, chooses one or more objectives (work in Germany, remote,
freelance, Ausbildung) and uploads a CV. Everything after that is automatic:

```
upload  →  text extraction (PDF / DOCX)
        →  AI extraction      → structured profile with a confidence on every field
        →  classification     → one of 13 professional domains + specialisation
        →  questionnaire      → only what the CV could not answer, max 8 questions
        →  readiness per goal → explainable score, weighted factors, closeable gaps
        →  translation        → EN / DE / FR renderings, original file untouched
        →  review flags       → the profiles that actually need a human
```

The admin only sees the exceptions. That is the point of the milestone: `GET /api/admin/stats`
reports the share of intake that needed no human at all.

## Run it

```bash
cp .env.example .env      # fill in DATABASE_URL, JWT_SECRET, OPENAI_API_KEY
npm install
npm run migrate           # creates 24 tables + seeds the domain list
npm run create-admin "Your Name" you@meinroots.com 'a-real-password' --super
npm run dev               # http://localhost:4000
```

| Script | Purpose |
| --- | --- |
| `npm start` | Production server (API + in-process worker) |
| `npm run dev` | Same, restarting on file changes |
| `npm run migrate` | Apply pending migrations |
| `npm run migrate:status` | Show applied / pending / drifted |
| `npm run create-admin` | Create or promote an admin |
| `npm run smoke` | 27 checks against a running API — free, no OpenAI calls |
| `npm run e2e`¹ | Full pipeline with a generated CV — **spends OpenAI tokens** |
| `npm test` | 25 unit tests. No database, no network, no API keys |

¹ `node src/scripts/e2e.js`

## Endpoints

All responses are `{ data: … }` or `{ error: { code, message } }`. The `code` is stable and
the front end translates it; the `message` is English and meant for logs.

### Auth — `/api/auth`
| Method | Path | Notes |
| --- | --- | --- |
| POST | `/register` | Requires `gdprConsent: true`; creates the empty profile too |
| POST | `/login` | Same error for wrong password and unknown account |
| POST | `/refresh` | Rotates the refresh token |
| POST | `/logout` | Revokes the session |
| GET | `/me` | Current user |
| POST | `/password/reset-request` | Always reports success |
| POST | `/password/reset` | Revokes every other session |
| PATCH | `/goals`, `/locale`, `/notifications` | |
| POST | `/email/verify` | Single-use token from the confirmation email |
| POST | `/email/verify/resend` | Session required, so it cannot probe which addresses exist |
| POST | `/password/change` | Requires the current password; ends every other session |
| DELETE | `/account` | Self-service GDPR erasure; requires the password |

### CV — `/api/cv`
| Method | Path | Notes |
| --- | --- | --- |
| POST | `/upload` | multipart, field `cv`, ≤10 MB, PDF/DOCX. Returns immediately, queues the analysis |
| GET | `/documents`, `/documents/current`, `/documents/:id` | |
| GET | `/documents/:id/status` | What the upload screen polls: stage, retry state, `translationsPending` |
| GET | `/documents/:id/versions` | EN/DE/FR, each labelled source or AI-generated |
| GET | `/documents/:id/file` | The original bytes, unmodified |
| POST | `/documents/:id/reanalyse` | |
| DELETE | `/documents/:id` | Soft-deletes the row, destroys the file |

### Profile — `/api/profile`
`GET /me`, `PATCH /me`, `GET /me/readiness`, `POST /me/readiness/refresh`

Section editing — `experiences`, `education`, `certifications`, `skills`, `languages`:
`POST /me/:section`, `PUT /me/:section/:id`, `DELETE /me/:section/:id`,
`PATCH /me/:section/order`, `GET /me/edits`.

### Questionnaire — `/api/questionnaire`
`GET /current`, `POST /answers`, `POST /complete`

### Admin — `/api/admin` (role `admin` or `super_admin`)
Consumed by the [review console](../admin/README.md).

`GET /stats`, `GET /candidates`, `GET /candidates/:userId`, `POST /candidates/:userId/review`,
`POST /flags/:flagId/resolve`, `POST /cv-versions/:versionId/approve`,
`GET /documents/:id/file` (any candidate's original CV), `GET /jobs`,
`POST /jobs/:jobId/retry` (revive a job that gave up), `GET /audit`,
`DELETE /candidates/:userId` (GDPR erasure, `super_admin` only).

## Decisions worth knowing

**Postgres is also the job queue.** Analysis takes tens of seconds and cannot run inside a
request, so it is a `jobs` table drained by a worker using `FOR UPDATE SKIP LOCKED`. Adding
Redis would mean another service to install, secure and back up on the same box for no
throughput this milestone will ever reach. The worker runs in the API process by default —
set `WORKER_IN_PROCESS=false` and start a second process with `WORKER_ONLY=true` when
analysis starts competing with request latency.

**The document is marked `analysed` before translations run.** Everything the candidate is
waiting to see is finished by then; translations are the slowest, most expensive step and
nothing depends on them. `translationsPending` in the status response is how the UI tells the
difference, and a failed translation cannot cost a candidate their profile.

**Every AI value carries a confidence, and low confidence raises a flag.** `refreshReviewFlags`
turns "open every CV" into "open the flagged ones", and resolves flags that a re-analysis
fixed so the queue does not fill with stale exceptions.

**Structured outputs, not prose.** Each AI step uses `json_schema` with `strict: true`, so the
model's reply conforms at decode time. There is no "parse JSON out of the response" step and
no retry loop for malformed output.

**The original file is never rewritten.** Translations and structured data are separate rows.
`storage/cvs/<user-id>/<uuid>.<ext>`, sha256 recorded at upload, and the e2e test asserts the
downloaded bytes still match what was sent.

**A candidate edit is not the same as an extraction.** Correcting a row sets
`source = 'candidate'`, clears its confidence and records the full before/after in
`profile_edits`. A hand-typed row must never look like a confidently parsed one to the
review queue, and an admin must still be able to see what the AI originally read. A
re-analysis replaces only `source = 'ai'` rows, so uploading a new CV never destroys
corrections.

**Email is a database row first, then a job.** A slow SMTP server must not hold up the
request that triggered it, and having no SMTP configured is a supported state — messages
are recorded as `skipped` and their links logged, so the platform stays usable. Every
attempt lands in `outbound_emails`, because "did the candidate get the reset link?" has to
be answerable.

**Tokens are httpOnly cookies.** A short access JWT plus a rotating refresh token whose sha256
— never the token — is stored, so a database dump cannot be replayed as live sessions.

## Deployment (Contabo, Ubuntu 24.04)

Already provisioned and running. Node 22, PostgreSQL 16, nginx.

```
/opt/meinroots/server         this API, run by systemd as user `meinroots`
/opt/meinroots/client         the candidate site build   — meinroots.de
/opt/meinroots/admin          the review console build   — admin.meinroots.de
/opt/meinroots/server/storage uploaded CVs
```

```bash
systemctl status meinroots-api
journalctl -u meinroots-api -f
```

`deploy/meinroots-api.service` and `deploy/nginx.conf` are the files installed on the box.
nginx serves **two hostnames over HTTPS** — `meinroots.de` and `admin.meinroots.de` —
each with its own certificate and document root, and each proxying `/api` to the Node
process so both stay same-origin with first-party cookies. Port 80 exists only to answer
Let's Encrypt challenges and redirect everything else to HTTPS.

### TLS

Certificates come from Let’s Encrypt via `certbot certonly --webroot`, deliberately not
the nginx plugin: the plugin rewrites `nginx.conf`, which would make the copy in this repo
stop matching the box. Two certificates, both ECDSA, renewed automatically by
`certbot.timer`.

`deploy/certbot-reload-nginx.sh` is installed to
`/etc/letsencrypt/renewal-hooks/deploy/`. Without it renewal succeeds and nothing changes —
nginx keeps the old certificate in memory until something reloads it, and the site simply
becomes untrusted one day with no warning.

Verified: TLS 1.2/1.3 only (1.0 and 1.1 refused), HSTS a year with `includeSubDomains`,
HTTP 301s to HTTPS, `www` 301s to the apex, session cookies `HttpOnly; Secure; SameSite=Lax`,
and `certbot renew --dry-run` passing for both certificates.

The console is not reachable from the public site: `/admin` and the usual guesses return a
flat 404 on port 80, and nothing on the site links to it. Restricting it further — an
office-IP `allow`/`deny` pair or `auth_basic` — is a few lines in the `admin.meinroots.de` block, not a
code change. Both are written out as comments in `deploy/nginx.conf`.

### Before this is production

1. ~~**TLS.**~~ Done — `meinroots.de` and `admin.meinroots.de` are on HTTPS with automatic
   renewal, and `COOKIE_SECURE=true` is set.
2. **Rotate the credentials** that were shared over chat: the OpenAI key and the server's root
   password. Then disable root password login in favour of an SSH key.
3. **Off-server backup copies.** `deploy/backup.sh` runs nightly at 03:20 through
   `meinroots-backup.timer`: it dumps the database, archives the uploaded CVs, verifies both
   are readable, and prunes to 14 days plus 6 monthly keepers. Restore steps are at the
   bottom of that script, and restoring has been tested into a scratch database. What
   remains is copying `/opt/meinroots/backups` off this machine — today they sit on the same
   disk as the data they protect, which covers a bad deploy but not a dead server.
